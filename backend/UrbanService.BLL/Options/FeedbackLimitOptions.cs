namespace UrbanService.BLL.Options;

/// <summary>Hạn mức gửi phản ánh, để một tài khoản không spam hệ thống tiếp nhận.</summary>
public sealed class FeedbackLimitOptions
{
    public const string SectionName = "FeedbackLimits";

    /// <summary>Số phản ánh tối đa một tài khoản gửi từ web mỗi ngày (giờ Việt Nam).</summary>
    public int DailyPerUser { get; set; } = 3;
}
