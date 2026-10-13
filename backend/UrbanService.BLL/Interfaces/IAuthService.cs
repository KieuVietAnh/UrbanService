using UrbanService.BLL.Dtos;

namespace UrbanService.BLL.Interfaces
{
    public interface IAuthService
    {
        //Task RequestRegisterOtpAsync(RegisterRequest req);
        //Task<AuthResultDto> VerifyRegisterOtpAsync(VerifyOtpRequest req);
        Task<AuthResultDto> RegisterAsync(RegisterRequest req);
        Task<AuthResultDto> LoginAsync(LoginRequest req);
        Task<AuthResultDto> GoogleLoginAsync(GoogleLoginRequest req);
        Task<AuthResultDto> RefreshTokenAsync(RefreshTokenRequest req);
        /// <summary>Gửi OTP xác thực tới email đang lưu trên tài khoản.</summary>
        Task RequestEmailVerificationOtpAsync(
            Guid userId,
            CancellationToken cancellationToken = default);

        /// <summary>Xác thực OTP email và cấp lại phiên đăng nhập.</summary>
        Task<AuthResultDto> VerifyEmailAsync(
            Guid userId,
            VerifyOtpRequest req,
            CancellationToken cancellationToken = default);

        Task<AuthResultDto> UpdatePendingAccountAsync(
            Guid userId,
            PendingAccountUpdateRequest req,
            CancellationToken cancellationToken = default);
        Task RequestForgotPasswordOtpAsync(
            ForgotPasswordRequest req,
            CancellationToken cancellationToken = default);
        Task VerifyForgotPasswordOtpAsync(
            VerifyForgotPasswordOtpRequest req,
            CancellationToken cancellationToken = default);
        Task ResetPasswordAsync(
            ResetPasswordRequest req,
            CancellationToken cancellationToken = default);
    }
}
