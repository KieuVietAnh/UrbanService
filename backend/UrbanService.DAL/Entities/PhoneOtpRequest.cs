namespace UrbanService.DAL.Entities;

/// <summary>
/// Dữ liệu hạn mức OTP số điện thoại của luồng Firebase cũ.
/// Giữ entity để tương thích schema và dữ liệu hiện tại; luồng xác thực email không
/// còn ghi hoặc đọc bảng này.
/// </summary>
public partial class PhoneOtpRequest
{
    public long PhoneOtpRequestId { get; set; }

    public string PhoneNumber { get; set; } = null!;

    /// <summary>Ngày theo giờ Việt Nam, dạng yyyy-MM-dd, để đếm theo ngày làm việc.</summary>
    public string Day { get; set; } = null!;

    public Guid? RequestedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}
