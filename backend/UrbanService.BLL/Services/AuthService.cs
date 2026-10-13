using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using UrbanService.BLL.Common;
using UrbanService.BLL.Common.Constraint;
using UrbanService.BLL.Common.Helpers;
using UrbanService.BLL.Common.Securities;
using UrbanService.BLL.Dtos;
using UrbanService.BLL.Interfaces;
using UrbanService.DAL.Entities;
using UrbanService.DAL.Interfaces;

namespace UrbanService.BLL.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUnitOfWork _uow;
        private readonly IConfiguration _cfg;
        private readonly IJwtTokenGenerator _jwt;
        private readonly IEmailSender _emailSender;
        private readonly IMemoryCache _cache;
        private readonly ILogger<AuthService> _logger;
        private const int EmailVerificationOtpMinutes = 5;
        private const int EmailVerificationOtpCooldownSeconds = 60;
        private const int EmailVerificationOtpMaxAttempts = 5;
        private const int PasswordResetOtpMinutes = 5;
        private const int PasswordResetOtpCooldownSeconds = 60;
        private const int PasswordResetOtpMaxAttempts = 5;
        private const int DefaultRefreshTokenExpireDays = 7;
        private const string InvalidPasswordResetOtpMessage = "OTP không hợp lệ hoặc đã hết hạn.";
        private const int ConflictStatusCode = 409;
        private static readonly object PasswordResetCacheSync = new();
        private static readonly object EmailVerificationCacheSync = new();

        public AuthService(
            IUnitOfWork uow,
            IConfiguration cfg,
            IJwtTokenGenerator jwt,
            IEmailSender emailSender,
            IMemoryCache cache,
            ILogger<AuthService> logger)
        {
            _uow = uow;
            _cfg = cfg;
            _jwt = jwt;
            _emailSender = emailSender;
            _cache = cache;
            _logger = logger;
        }

        public async Task<AuthResultDto> LoginAsync(LoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Password))
            {
                throw new Exception("Email và mật khẩu là bắt buộc.");
            }

            var email = NormalizeEmail(req.Email);
            var userRepo = _uow.GetRepository<User>();
            var user = await userRepo.FindAsync(
                u => u.Email.ToLower() == email,
                q => q.Include(u => u.Role));

            if (user == null || !PasswordHasher.Verify(req.Password, user.PasswordHash))
            {
                throw new UnauthorizedAccessException(
                    "Email không đúng hoặc sai mật khẩu.");
            }

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
            }

            /*
             * Không chặn tài khoản chưa xác thực email ở đây. Đăng nhập là tự do;
             * xác thực email chỉ là điều kiện để ghi dữ liệu, và chốt đó nằm ở
             * FeedbackService. Client đọc AuthResultDto.IsVerified để biết có
             * cần nhắc người dùng xác thực hay không.
             */
            return await IssueAuthResultAsync(user);
        }

        public async Task<AuthResultDto> RegisterAsync(RegisterRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Password))
            {
                throw new Exception("Email và mật khẩu là bắt buộc.");
            }

            var email = NormalizeEmail(req.Email);

            /*
             * Số điện thoại vẫn là thông tin liên hệ bắt buộc của hồ sơ, nhưng OTP
             * xác thực tài khoản được gửi tới email.
             */
            if (string.IsNullOrWhiteSpace(req.Phone))
            {
                throw new Exception("Số điện thoại là bắt buộc.");
            }

            var phoneNumber = PhoneNumberHelper.NormalizeRequired(req.Phone);
            var fullName = string.IsNullOrWhiteSpace(req.Fullname) ? email : req.Fullname.Trim();

            if (req.Password.Length < PasswordPolicy.MinLength)
            {
                throw new Exception(
                    $"Mật khẩu phải có ít nhất {PasswordPolicy.MinLength} ký tự.");
            }

            var userRepo = _uow.GetRepository<User>();

            /*
             * Một số điện thoại chỉ gắn với một tài khoản. Trước đây chỗ này chỉ chặn
             * khi số đã thuộc tài khoản ĐÃ xác thực, nên hai tài khoản chưa xác thực
             * vẫn khai cùng một số và database đọng lại số trùng.
             */
            var phoneTaken = await userRepo.Entities
                .AsNoTracking()
                .AnyAsync(candidate =>
                    candidate.IsActive &&
                    candidate.PhoneNumber == phoneNumber);

            if (phoneTaken)
            {
                throw new BusinessRuleException(
                    BusinessErrorCode.PhoneAlreadyUsed,
                    "Số điện thoại đã được sử dụng. Hãy đăng nhập, hoặc dùng chức năng quên mật khẩu.",
                    ConflictStatusCode);
            }
            var existingUser = await userRepo.FindAsync(
                u => u.Email.ToLower() == email.ToLower(),
                q => q.Include(u => u.Role));

            if (existingUser != null)
            {
                /*
                 * Email đã có tài khoản thì luôn báo trùng, kể cả khi tài khoản đó
                 * chưa xác thực.
                 *
                 * Trước đây chỗ này cho đăng ký đè lên tài khoản chưa xác thực, để
                 * người bỏ dở giữa chừng không bị kẹt. Nhưng nó mở ra đường chiếm
                 * tài khoản: ai biết email của một tài khoản chưa xác thực chỉ cần
                 * đăng ký lại bằng email đó là ghi đè được cả mật khẩu lẫn số điện
                 * thoại của người ta.
                 *
                 * Người bỏ dở vẫn có hai đường quay lại mà không cần ghi đè: đăng
                 * nhập bằng email với mật khẩu họ vừa đặt, hoặc
                 * dùng luồng quên mật khẩu qua email.
                 */
                throw new Exception(
                    "Email đã được sử dụng. Hãy đăng nhập, hoặc dùng chức năng quên mật khẩu.");
            }

            var role = await GetOrCreateDefaultRoleAsync();
            var now = DateTime.UtcNow;
            var user = new User
            {
                UserId = Guid.NewGuid(),
                RoleId = role.RoleId,
                FullName = fullName,
                Email = email,
                PasswordHash = PasswordHasher.Hash(req.Password),
                PhoneNumber = phoneNumber,
                IsActive = true,
                IsVerified = false,
                IsRefreshTokenRevoked = false,
                CreatedAt = now,
                UpdatedAt = now,
                Role = role
            };

            await userRepo.AddAsync(user);

            return await IssueAuthResultAsync(user);
        }

        public async Task<AuthResultDto> GoogleLoginAsync(GoogleLoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.IdToken))
            {
                throw new Exception("Google ID token là bắt buộc.");
            }

            var clientId = _cfg["GoogleAuth:ClientId"];
            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new InvalidOperationException("Missing config: GoogleAuth:ClientId");
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    req.IdToken.Trim(),
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = [clientId]
                    });
            }
            catch (InvalidJwtException)
            {
                throw new UnauthorizedAccessException("Google ID token không hợp lệ hoặc đã hết hạn.");
            }

            if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
            {
                throw new UnauthorizedAccessException("Google chưa xác thực email này.");
            }

            var email = payload.Email.Trim().ToLower();
            var user = await _uow.GetRepository<User>().FindAsync(
                u => u.Email.ToLower() == email,
                q => q.Include(u => u.Role));

            /*
             * Google đã xác thực quyền sở hữu email, nên tài khoản đăng nhập Google
             * được xem là đã hoàn tất bước xác thực email.
             */
            if (user == null)
            {
                user = await CreateGoogleUserAsync(email, payload.Name);
            }
            else if (!user.IsVerified)
            {
                user.IsVerified = true;
                user.UpdatedAt = DateTime.UtcNow;
            }

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
            }

            return await IssueAuthResultAsync(user);
        }

        public async Task<AuthResultDto> RefreshTokenAsync(RefreshTokenRequest req)
        {
            var refreshToken = req.RefreshToken?.Trim();

            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                throw new UnauthorizedAccessException();
            }

            if (!TryGetRefreshTokenExpiresAt(refreshToken, out var expiresAt))
            {
                throw new UnauthorizedAccessException();
            }

            var refreshTokenHash = HashRefreshToken(refreshToken);
            var user = await _uow.GetRepository<User>().FindAsync(
                u => u.RefreshToken == refreshTokenHash,
                q => q.Include(u => u.Role));

            if (user == null || !user.IsActive || user.IsRefreshTokenRevoked)
            {
                throw new UnauthorizedAccessException();
            }

            if (expiresAt <= DateTimeOffset.UtcNow)
            {
                user.IsRefreshTokenRevoked = true;
                user.UpdatedAt = DateTime.UtcNow;
                await _uow.SaveAsync();
                throw new UnauthorizedAccessException();
            }

            return await IssueAuthResultAsync(user);
        }

        /// <summary>Gửi OTP xác thực tới email hiện tại của tài khoản.</summary>
        public async Task RequestEmailVerificationOtpAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var user = await _uow.GetRepository<User>().GetByIdAsync(userId)
                ?? throw new Exception("Không tìm thấy người dùng.");

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
            }

            if (user.IsVerified)
            {
                return;
            }

            var email = NormalizeEmail(user.Email);
            var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var otpKey = GetEmailVerificationOtpKey(userId);
            var cooldownKey = GetEmailVerificationOtpCooldownKey(userId);
            var state = new EmailVerificationOtpState
            {
                UserId = userId,
                Email = email,
                OtpHash = PasswordHasher.Hash(otp)
            };

            lock (EmailVerificationCacheSync)
            {
                if (_cache.TryGetValue(cooldownKey, out _))
                {
                    return;
                }

                if (_cache.TryGetValue<EmailVerificationOtpState>(otpKey, out var currentState) &&
                    currentState != null)
                {
                    lock (currentState.SyncRoot)
                    {
                        if (currentState.IsConsuming)
                        {
                            return;
                        }
                    }
                }

                _cache.Set(
                    cooldownKey,
                    true,
                    TimeSpan.FromSeconds(EmailVerificationOtpCooldownSeconds));
                _cache.Set(
                    otpKey,
                    state,
                    TimeSpan.FromMinutes(EmailVerificationOtpMinutes));
            }

            var body = $"""
                <h2>Xác thực email UrbanService</h2>
                <p>Xin chào {System.Net.WebUtility.HtmlEncode(user.FullName)},</p>
                <p>Mã OTP xác thực tài khoản của bạn là:</p>
                <h1 style="letter-spacing: 6px">{otp}</h1>
                <p>Mã có hiệu lực trong {EmailVerificationOtpMinutes} phút.</p>
                <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
                """;

            try
            {
                await _emailSender.SendAsync(new EmailMessageDto
                {
                    To = [email],
                    Subject = "Mã OTP xác thực email UrbanService",
                    Body = body
                }, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                RemoveEmailVerificationIssuance(otpKey, cooldownKey, state);
                throw;
            }
            catch (Exception ex)
            {
                RemoveEmailVerificationIssuance(otpKey, cooldownKey, state);
                _logger.LogWarning(ex, "Không thể gửi OTP xác thực email cho user {UserId}.", userId);
                throw new Exception("Không thể gửi mã xác thực email. Vui lòng thử lại sau.");
            }
        }

        /// <summary>Xác thực OTP email và cấp lại token chứa trạng thái mới.</summary>
        public async Task<AuthResultDto> VerifyEmailAsync(
            Guid userId,
            VerifyOtpRequest req,
            CancellationToken cancellationToken = default)
        {
            var otp = req.Otp?.Trim();
            if (string.IsNullOrWhiteSpace(otp) || otp.Length != 6 || !otp.All(char.IsDigit))
            {
                throw new Exception("OTP không hợp lệ hoặc đã hết hạn.");
            }

            var user = await _uow.GetRepository<User>().Entities
                .Include(candidate => candidate.Role)
                .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken)
                ?? throw new Exception("Không tìm thấy người dùng.");

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
            }

            if (user.IsVerified)
            {
                return await IssueAuthResultAsync(user);
            }

            var currentEmail = NormalizeEmail(user.Email);
            var otpKey = GetEmailVerificationOtpKey(userId);
            var cooldownKey = GetEmailVerificationOtpCooldownKey(userId);
            if (!_cache.TryGetValue<EmailVerificationOtpState>(otpKey, out var state) ||
                state == null ||
                state.UserId != userId ||
                !string.Equals(state.Email, currentEmail, StringComparison.OrdinalIgnoreCase))
            {
                throw new Exception("OTP không hợp lệ hoặc đã hết hạn.");
            }

            lock (state.SyncRoot)
            {
                if (state.IsConsuming)
                {
                    throw new Exception("OTP không hợp lệ hoặc đã hết hạn.");
                }

                if (!PasswordHasher.Verify(otp, state.OtpHash))
                {
                    state.FailedAttempts++;
                    if (state.FailedAttempts >= EmailVerificationOtpMaxAttempts)
                    {
                        _cache.Remove(otpKey);
                        _cache.Remove(cooldownKey);
                    }
                    throw new Exception("OTP không hợp lệ hoặc đã hết hạn.");
                }

                state.IsConsuming = true;
            }

            var originalVerified = user.IsVerified;
            var originalRefreshToken = user.RefreshToken;
            var originalRefreshTokenRevoked = user.IsRefreshTokenRevoked;
            var originalUpdatedAt = user.UpdatedAt;

            try
            {
                user.IsVerified = true;
                user.UpdatedAt = DateTime.UtcNow;
                var result = await IssueAuthResultAsync(user);
                _cache.Remove(otpKey);
                _cache.Remove(cooldownKey);
                _logger.LogInformation("Tài khoản {UserId} đã xác thực email.", userId);
                return result;
            }
            catch
            {
                user.IsVerified = originalVerified;
                user.RefreshToken = originalRefreshToken;
                user.IsRefreshTokenRevoked = originalRefreshTokenRevoked;
                user.UpdatedAt = originalUpdatedAt;
                lock (state.SyncRoot)
                {
                    state.IsConsuming = false;
                }
                throw;
            }
        }

        private async Task EnsurePhoneNumberAvailableAsync(string phoneNumber, Guid? excludedUserId)
        {
            var taken = await _uow.GetRepository<User>().Entities
                .AsNoTracking()
                .AnyAsync(candidate =>
                    candidate.IsActive &&
                    candidate.PhoneNumber == phoneNumber &&
                    (excludedUserId == null || candidate.UserId != excludedUserId));

            if (taken)
            {
                throw new BusinessRuleException(
                    BusinessErrorCode.PhoneAlreadyUsed,
                    "Số điện thoại này đã được dùng cho một tài khoản khác.",
                    ConflictStatusCode);
            }
        }

        /// <summary>
        /// Sửa thông tin đăng ký của tài khoản chưa xác thực email.
        ///
        /// Dùng khi người dùng gõ nhầm thông tin lúc đăng ký và muốn quay lại sửa
        /// trước khi xác thực. Đăng ký lại cũng không xong vì email cũ đã chiếm chỗ.
        ///
        /// Giữ nguyên email hoặc số điện thoại của chính mình thì không báo trùng,
        /// chỉ báo khi chúng đang thuộc về tài khoản khác. Không gửi OTP ở đây;
        /// người dùng bấm gửi mã ở màn xác thực email.
        /// </summary>
        public async Task<AuthResultDto> UpdatePendingAccountAsync(
            Guid userId,
            PendingAccountUpdateRequest req,
            CancellationToken cancellationToken = default)
        {
            var userRepo = _uow.GetRepository<User>();
            var user = await userRepo.Entities
                .Include(candidate => candidate.Role)
                .FirstOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken)
                ?? throw new Exception("Không tìm thấy người dùng.");

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
            }

            if (user.IsVerified)
            {
                throw new Exception(
                    "Tài khoản đã xác thực nên không sửa được qua API này.");
            }

            var email = NormalizeEmail(req.Email);
            var emailChanged = !string.Equals(
                user.Email,
                email,
                StringComparison.OrdinalIgnoreCase);

            if (emailChanged)
            {
                var emailTaken = await userRepo.Entities
                    .AnyAsync(
                        candidate => candidate.UserId != userId &&
                            candidate.Email.ToLower() == email,
                        cancellationToken);

                if (emailTaken)
                {
                    throw new Exception("Email đã được sử dụng.");
                }

                _cache.Remove(GetEmailVerificationOtpKey(userId));
                _cache.Remove(GetEmailVerificationOtpCooldownKey(userId));
            }

            if (!string.IsNullOrWhiteSpace(req.NewPassword))
            {
                if (req.NewPassword.Length < PasswordPolicy.MinLength)
                {
                    throw new Exception(
                        $"Mật khẩu phải có ít nhất {PasswordPolicy.MinLength} ký tự.");
                }

                user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
            }

            var phoneNumber = PhoneNumberHelper.NormalizeRequired(req.PhoneNumber);
            await EnsurePhoneNumberAvailableAsync(phoneNumber, excludedUserId: userId);

            user.FullName = string.IsNullOrWhiteSpace(req.FullName)
                ? email
                : req.FullName.Trim();
            user.Email = email;
            user.PhoneNumber = phoneNumber;
            user.UpdatedAt = DateTime.UtcNow;
            await _uow.SaveAsync();

            return await IssueAuthResultAsync(user);
        }

        public async Task RequestForgotPasswordOtpAsync(
            ForgotPasswordRequest req,
            CancellationToken cancellationToken = default)
        {
            var normalizedEmail = NormalizeEmail(req.Email);
            var user = await _uow.GetRepository<User>().Entities
                .FirstOrDefaultAsync(
                    candidate => candidate.IsActive && candidate.Email.ToLower() == normalizedEmail,
                    cancellationToken);

            if (user == null)
            {
                return;
            }

            var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var otpKey = GetPasswordResetOtpKey(normalizedEmail);
            var cooldownKey = GetPasswordResetOtpCooldownKey(normalizedEmail);
            var state = new PasswordResetOtpState
            {
                UserId = user.UserId,
                OtpHash = PasswordHasher.Hash(otp)
            };

            lock (PasswordResetCacheSync)
            {
                if (_cache.TryGetValue(cooldownKey, out _))
                {
                    return;
                }

                if (_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) &&
                    currentState != null)
                {
                    lock (currentState.SyncRoot)
                    {
                        if (currentState.IsConsuming)
                        {
                            return;
                        }
                    }
                }

                _cache.Set(
                    cooldownKey,
                    true,
                    TimeSpan.FromSeconds(PasswordResetOtpCooldownSeconds));
                _cache.Set(
                    otpKey,
                    state,
                    TimeSpan.FromMinutes(PasswordResetOtpMinutes));
            }

            var body = $"""
                <h2>Đặt lại mật khẩu UrbanService</h2>
                <p>Xin chào {System.Net.WebUtility.HtmlEncode(user.FullName)},</p>
                <p>Mã OTP đặt lại mật khẩu của bạn là:</p>
                <h1 style="letter-spacing: 6px">{otp}</h1>
                <p>Mã có hiệu lực trong {PasswordResetOtpMinutes} phút.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                """;

            try
            {
                await _emailSender.SendAsync(new EmailMessageDto
                {
                    To = [user.Email],
                    Subject = "Mã OTP đặt lại mật khẩu UrbanService",
                    Body = body
                }, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                RemovePasswordResetIssuance(otpKey, cooldownKey, state);
                throw;
            }
            catch (Exception)
            {
                RemovePasswordResetIssuance(otpKey, cooldownKey, state);
                _logger.LogWarning("Không thể gửi OTP đặt lại mật khẩu do lỗi nhà cung cấp email.");
            }
        }

        /// <summary>
        /// Kiểm tra OTP quên mật khẩu mà không tiêu thụ nó.
        ///
        /// Dùng cho giao diện tách làm nhiều bước: nhập email, nhập OTP, rồi mới
        /// nhập mật khẩu mới. OTP phải còn nguyên sau bước này để
        /// <see cref="ResetPasswordAsync"/> còn dùng được, nên ở đây chỉ đối chiếu
        /// chứ không xóa khỏi cache.
        ///
        /// Nhập sai vẫn cộng vào bộ đếm và vẫn hủy OTP khi chạm ngưỡng, nếu không
        /// endpoint này sẽ thành đường dò mã không giới hạn, đi vòng qua giới hạn
        /// mà luồng reset đang có.
        /// </summary>
        public async Task VerifyForgotPasswordOtpAsync(
            VerifyForgotPasswordOtpRequest req,
            CancellationToken cancellationToken = default)
        {
            var normalizedEmail = NormalizeEmail(req.Email);

            var otp = req.Otp?.Trim();
            if (string.IsNullOrWhiteSpace(otp) || otp.Length != 6 || !otp.All(char.IsDigit))
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            var otpKey = GetPasswordResetOtpKey(normalizedEmail);
            if (!_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var state) || state == null)
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            var user = await _uow.GetRepository<User>().Entities
                .FirstOrDefaultAsync(
                    candidate => candidate.IsActive && candidate.Email.ToLower() == normalizedEmail,
                    cancellationToken);

            if (user == null || user.UserId != state.UserId)
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            lock (state.SyncRoot)
            {
                if (!_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) ||
                    !ReferenceEquals(currentState, state) ||
                    state.IsConsuming)
                {
                    throw new Exception(InvalidPasswordResetOtpMessage);
                }

                if (!PasswordHasher.Verify(otp, state.OtpHash))
                {
                    state.FailedAttempts++;
                    if (state.FailedAttempts >= PasswordResetOtpMaxAttempts)
                    {
                        _cache.Remove(otpKey);
                    }

                    throw new Exception(InvalidPasswordResetOtpMessage);
                }
            }
        }

        public async Task ResetPasswordAsync(
            ResetPasswordRequest req,
            CancellationToken cancellationToken = default)
        {
            var normalizedEmail = NormalizeEmail(req.Email);

            if (string.IsNullOrWhiteSpace(req.NewPassword) ||
                req.NewPassword.Length < PasswordPolicy.MinLength)
            {
                throw new Exception(
                    $"Mật khẩu mới phải có ít nhất {PasswordPolicy.MinLength} ký tự.");
            }

            var otp = req.Otp?.Trim();
            if (string.IsNullOrWhiteSpace(otp) || otp.Length != 6 || !otp.All(char.IsDigit))
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            var otpKey = GetPasswordResetOtpKey(normalizedEmail);
            if (!_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var state) || state == null)
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            var user = await _uow.GetRepository<User>().Entities
                .FirstOrDefaultAsync(
                    candidate => candidate.IsActive && candidate.Email.ToLower() == normalizedEmail,
                    cancellationToken);

            if (user == null || user.UserId != state.UserId)
            {
                throw new Exception(InvalidPasswordResetOtpMessage);
            }

            lock (state.SyncRoot)
            {
                if (!_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) ||
                    !ReferenceEquals(currentState, state) ||
                    state.IsConsuming)
                {
                    throw new Exception(InvalidPasswordResetOtpMessage);
                }

                if (!PasswordHasher.Verify(otp, state.OtpHash))
                {
                    state.FailedAttempts++;
                    if (state.FailedAttempts >= PasswordResetOtpMaxAttempts)
                    {
                        _cache.Remove(otpKey);
                    }

                    throw new Exception(InvalidPasswordResetOtpMessage);
                }

                state.IsConsuming = true;
            }

            var originalPasswordHash = user.PasswordHash;
            var originalRefreshToken = user.RefreshToken;
            var originalIsRefreshTokenRevoked = user.IsRefreshTokenRevoked;
            var originalUpdatedAt = user.UpdatedAt;

            try
            {
                user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
                user.RefreshToken = null;
                user.IsRefreshTokenRevoked = true;
                user.UpdatedAt = DateTime.UtcNow;
                await _uow.SaveAsync();

                lock (state.SyncRoot)
                {
                    if (_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) &&
                        ReferenceEquals(currentState, state))
                    {
                        _cache.Remove(otpKey);
                    }
                }
            }
            catch
            {
                user.PasswordHash = originalPasswordHash;
                user.RefreshToken = originalRefreshToken;
                user.IsRefreshTokenRevoked = originalIsRefreshTokenRevoked;
                user.UpdatedAt = originalUpdatedAt;

                lock (state.SyncRoot)
                {
                    if (_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) &&
                        ReferenceEquals(currentState, state))
                    {
                        state.IsConsuming = false;
                    }
                }

                throw;
            }
        }

        /// <summary>
        /// Tạo tài khoản cho người dùng đăng nhập Google lần đầu.
        ///
        /// Tài khoản chưa có số điện thoại và IsVerified = true vì Google đã xác
        /// thực email. Mật khẩu được
        /// đặt bằng một chuỗi ngẫu nhiên không ai biết, nên đường đăng nhập bằng
        /// mật khẩu coi như bị khóa; người dùng muốn dùng mật khẩu thì phải đi
        /// qua luồng quên mật khẩu.
        /// </summary>
        private async Task<User> CreateGoogleUserAsync(
            string email,
            string? displayName)
        {
            var role = await GetOrCreateDefaultRoleAsync();
            var now = DateTime.UtcNow;
            var user = new User
            {
                UserId = Guid.NewGuid(),
                RoleId = role.RoleId,
                FullName = string.IsNullOrWhiteSpace(displayName) ? email : displayName.Trim(),
                Email = email,
                PasswordHash = PasswordHasher.Hash(
                    Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))),
                PhoneNumber = null,
                IsActive = true,
                IsVerified = true,
                IsRefreshTokenRevoked = false,
                CreatedAt = now,
                UpdatedAt = now,
                Role = role
            };

            await _uow.GetRepository<User>().AddAsync(user);
            await _uow.SaveAsync();

            return user;
        }

        private async Task<Role> GetOrCreateDefaultRoleAsync()
        {
            var defaultRole = _cfg["Auth:DefaultRole"] ?? UserRole.SERVICEUSER;
            var roleRepo = _uow.GetRepository<Role>();
            var role = await roleRepo.FindAsync(r => r.RoleName.ToUpper() == defaultRole.ToUpper(), include: null);

            if (role != null)
            {
                return role;
            }

            role = new Role
            {
                RoleName = defaultRole,
                Description = "Default registered user role"
            };

            await roleRepo.AddAsync(role);
            await _uow.SaveAsync();

            return role;
        }

        private async Task<AuthResultDto> IssueAuthResultAsync(User user)
        {
            var (refreshToken, _) = GenerateRefreshToken();
            user.RefreshToken = HashRefreshToken(refreshToken);
            user.IsRefreshTokenRevoked = false;
            user.UpdatedAt = DateTime.UtcNow;

            await _uow.SaveAsync();

            return ToAuthResult(user, refreshToken);
        }

        private AuthResultDto ToAuthResult(User user, string refreshToken)
        {
            return new AuthResultDto
            {
                Token = _jwt.Generate(user),
                RefreshToken = refreshToken,
                UserId = user.UserId,
                Email = user.Email,
                FullName = user.FullName,
                Role = user.Role?.RoleName,
                PhoneNumber = user.PhoneNumber,
                IsVerified = user.IsVerified
            };
        }

        private (string Token, DateTimeOffset ExpiresAt) GenerateRefreshToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(64);
            var token = Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
            var expiresAt = DateTimeOffset.UtcNow.AddDays(GetRefreshTokenExpireDays());

            return ($"{token}.{expiresAt.ToUnixTimeSeconds()}", expiresAt);
        }

        private int GetRefreshTokenExpireDays()
        {
            return int.TryParse(_cfg["Jwt:RefreshTokenExpireDays"], out var days) && days > 0
                ? days
                : DefaultRefreshTokenExpireDays;
        }

        private static string HashRefreshToken(string refreshToken)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
            return Convert.ToHexString(bytes);
        }

        private static bool TryGetRefreshTokenExpiresAt(string refreshToken, out DateTimeOffset expiresAt)
        {
            expiresAt = default;
            var separatorIndex = refreshToken.LastIndexOf('.');

            if (separatorIndex < 0 || separatorIndex == refreshToken.Length - 1)
            {
                return false;
            }

            var expiresAtText = refreshToken[(separatorIndex + 1)..];

            if (!long.TryParse(expiresAtText, out var unixSeconds))
            {
                return false;
            }

            expiresAt = DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
            return true;
        }

        private static string NormalizeEmail(string? email)
        {
            var normalizedEmail = email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedEmail) ||
                !MailAddress.TryCreate(normalizedEmail, out var parsedEmail) ||
                !string.Equals(parsedEmail.Address, normalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                throw new Exception("Email không hợp lệ.");
            }

            return normalizedEmail;
        }

        private static string GetPasswordResetOtpKey(string normalizedEmail) =>
            $"password-reset:{HashCacheSubject(normalizedEmail)}";

        private static string GetPasswordResetOtpCooldownKey(string normalizedEmail) =>
            $"password-reset-cooldown:{HashCacheSubject(normalizedEmail)}";

        private static string GetEmailVerificationOtpKey(Guid userId) =>
            $"email-verification:{userId:N}";

        private static string GetEmailVerificationOtpCooldownKey(Guid userId) =>
            $"email-verification-cooldown:{userId:N}";

        private static string HashCacheSubject(string value)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexString(bytes);
        }

        private void RemovePasswordResetIssuance(
            string otpKey,
            string cooldownKey,
            PasswordResetOtpState state)
        {
            lock (PasswordResetCacheSync)
            {
                if (_cache.TryGetValue<PasswordResetOtpState>(otpKey, out var currentState) &&
                    ReferenceEquals(currentState, state))
                {
                    _cache.Remove(otpKey);
                    _cache.Remove(cooldownKey);
                }
            }
        }

        private void RemoveEmailVerificationIssuance(
            string otpKey,
            string cooldownKey,
            EmailVerificationOtpState state)
        {
            lock (EmailVerificationCacheSync)
            {
                if (_cache.TryGetValue<EmailVerificationOtpState>(otpKey, out var currentState) &&
                    ReferenceEquals(currentState, state))
                {
                    _cache.Remove(otpKey);
                    _cache.Remove(cooldownKey);
                }
            }
        }

        private sealed class EmailVerificationOtpState
        {
            public Guid UserId { get; init; }

            public string Email { get; init; } = null!;

            public string OtpHash { get; init; } = null!;

            public int FailedAttempts { get; set; }

            public bool IsConsuming { get; set; }

            public object SyncRoot { get; } = new();
        }

        private sealed class PasswordResetOtpState
        {
            public Guid UserId { get; init; }

            public string OtpHash { get; init; } = null!;

            public int FailedAttempts { get; set; }

            public bool IsConsuming { get; set; }

            public object SyncRoot { get; } = new();
        }
    }
}
