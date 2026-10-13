namespace UrbanService.Authorization;

/// <summary>
/// Cho phép tài khoản chưa xác thực email gọi endpoint hoàn tất đăng ký.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class AllowUnverifiedEmailAttribute : Attribute
{
}
