using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using UrbanService.BLL.Common;
using UrbanService.BLL.Common.Constraint;
using UrbanService.DAL.Entities;
using UrbanService.DAL.Interfaces;

namespace UrbanService.Authorization;

/// <summary>Chặn thao tác ghi của người dân chưa xác thực email.</summary>
public sealed class EmailVerifiedWriteFilter : IAsyncAuthorizationFilter
{
    private static readonly HashSet<string> ReadOnlyMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Get,
        HttpMethods.Head,
        HttpMethods.Options,
        HttpMethods.Trace
    };

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (ReadOnlyMethods.Contains(context.HttpContext.Request.Method))
        {
            return;
        }

        var endpoint = context.HttpContext.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<IAllowAnonymous>() != null ||
            endpoint?.Metadata.GetMetadata<AllowUnverifiedEmailAttribute>() != null)
        {
            return;
        }

        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true ||
            !string.Equals(
                user.FindFirstValue(ClaimTypes.Role),
                UserRole.SERVICEUSER,
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.Equals(
                user.FindFirstValue(UserClaimTypes.EmailVerified),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return;
        }

        var uow = context.HttpContext.RequestServices.GetRequiredService<IUnitOfWork>();
        var isVerified = await uow.GetRepository<User>().Entities
            .AsNoTracking()
            .Where(candidate => candidate.UserId == parsedUserId)
            .Select(candidate => (bool?)candidate.IsVerified)
            .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (isVerified == true)
        {
            return;
        }

        context.Result = new ObjectResult(new ApiResponse<object?>
        {
            Status = StatusCodes.Status403Forbidden,
            Msg = "Bạn cần xác thực email trước khi thực hiện thao tác này.",
            Data = new { code = BusinessErrorCode.EmailNotVerified }
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}
