# Mobile System Staff — trạng thái hoàn thành

Đối chiếu ngày 07/09/2026 theo tài liệu SYSTEMSTAFF FE và `swagger.json` hiện tại. Mobile tách workspace `ServiceUser` và `SystemStaff`; Admin, Interaction Manager và Service Provider vẫn đi tới màn vai trò chưa hỗ trợ. Backend tiếp tục là lớp thực thi cuối cho role, ownership và status transition.

## Phạm vi đã triển khai

| Màn | Đường dẫn | Chức năng |
| --- | --- | --- |
| Tổng quan | `/staff/home` | Số liệu cá nhân theo Assigned, InProgress, NeedRework, SubmittedForApproval; danh sách sự vụ mới |
| Sự vụ | `/staff/incidents` | Tìm kiếm, Status/Priority/Severity/Area/Category, phân trang, chỉ lấy sự vụ được giao cho Staff hiện tại |
| Chi tiết Incident | `/staff/incidents/:id` | Tổng quan, toàn bộ Reports liên kết, SLA từng Report, Timeline, bắt đầu xử lý `Assigned → InProgress` |
| Đơn vị xử lý | `/staff/incidents/:id/provider` | Provider candidates, phân công một lần, liên hệ, contact logs và status riêng của Provider |
| Minh chứng & kết quả | `/staff/incidents/:id/resolution` | Ảnh/PDF, upload, kết quả lần đầu, gửi lại NeedRework, lịch sử kết quả và minh chứng |
| Tra cứu Report | `/staff/feedbacks` và `/:id` | Tìm kiếm/lọc/phân trang, chi tiết Report, AI metadata khi có, SLA và Incident liên kết; không có Verify/Reject |
| Trao đổi | `/staff/conversations`, `/staff/feedbacks/:id/chat` | Tin công khai và ghi chú nội bộ, giữ draft khi lỗi, làm mới khi focus |
| Thông báo | `/staff/notifications` | Lọc chưa đọc, phân trang, mark read/read-all và điều hướng nội bộ an toàn |
| Tài khoản | `/staff/account` | Chỉ đọc danh tính/phiên Staff và đăng xuất. Swagger `/api/profile` chỉ dành cho `ServiceUser`, nên Staff không gửi mutation sửa profile |

Không có queue kiểm duyệt AI, Verify/Reject Report, quyết định duplicate, Assign Staff, Approve Resolution hoặc quyết định NeedRework trong workspace Staff.

## Contract và quy tắc quan trọng

- Đăng nhập dùng email theo Swagger. Session chỉ hợp lệ khi có cả access token và refresh token; workspace fail-closed khi `isVerified !== true`.
- OTP tự gửi lần đầu. Refresh token cập nhật lại `role`/`isVerified`; nếu danh tính không khớp thì xóa session và query cache.
- Danh sách/Dashboard luôn scope bằng Staff hiện tại. Query keys chứa user/Incident/Report/assignment tương ứng; đăng xuất và đổi claim xóa cache.
- Incident và Feedback/Report là hai thực thể khác nhau. Không dựng Incident từ Feedback và không chọn `reports[0]` làm đại diện nghiệp vụ.
- SLA chỉ đọc bằng `GET /api/slas/feedback/{feedbackId}/status` cho từng Report; không suy diễn SLA tổng hợp ở cấp Incident.
- Provider dùng candidates + assignment của chính Incident. `GET .../provider-assignment` trả 204 nghĩa là chưa phân công.
- Minh chứng dùng `GET/POST /api/management/provider-assignments/{id}/completion-documents`, multipart `Description` và `Files`; hỗ trợ ảnh và PDF. PDF được lưu/hiển thị lịch sử nhưng không đưa vào `resolution.imageUrls`.
- Swagger hiện có `DELETE` cùng endpoint completion-documents. Mobile chỉ hiển thị thao tác xóa toàn bộ khi Incident thuộc Staff hiện tại và status chính xác là `NeedRework`, yêu cầu xác nhận rõ, đọc lại status trước mutation và refetch sau thành công. Draft/tệp đang chọn/lịch sử kết quả trước đó không bị xóa.
- Kết quả dùng `GET/POST /api/management/incidents/{incidentId}/resolutions`; POST 200 có thể không có body. Lần gửi lại NeedRework tạo bản ghi mới và giữ nguyên lịch sử.
- Chat Staff đọc `includeInternal=true`; luồng cư dân giữ `false`. Link thông báo chỉ ánh xạ route nội bộ được hỗ trợ.

## Kiểm chứng cuối

- TypeScript: PASS. ESLint mobile: 0 lỗi; 164 cảnh báo có sẵn ngoài phạm vi Staff/auth.
- `pnpm --dir apps/mobile test:staff`: **44/44 PASS**.
- Mobile + Shared API + web helper (bộ chọn lọc): **76/76 PASS**; axios refresh/session tests: **6/6 PASS**.
- Native fixture self-test: **114 assertions PASS**.
- Browser baseline 390 × 844: **131 ảnh**, **316 API request**, **131 geometry checks**, không lỗi runtime/unmocked API/geometry. ZIP có **142 tệp**.
- Ma trận browser 7 profile: **245 ảnh chọn lọc**, **994 geometry checks**, **2.212 API request**, 7/7 PASS. Profile gồm small, tiny, large text, gesture frame, 3-button frame, landscape stress và tablet.
- APK `staffValidation`: Gradle **BUILD SUCCESSFUL**, 832 tasks; artifact test-only 51.936.964 byte, SHA-256 `f554e4d92f9e8da494452d605a01b571dd031bb66c1bb8eacf78017c7337f07d`.
- Native Pixel 5 Android 16/API 36: PASS cho login Staff, dashboard, điều hướng vuốt và 3 nút, fontScale 200%, cửa sổ 720 × 1280, account read-only, chat + Gboard/IME, NeedRework evidence/confirmation. Năm tab và hitbox giãn đều toàn viewport, nằm trên system navigation; logcat không có `AndroidRuntime:E` hoặc `ReactNativeJS:E`.

Ảnh browser và APK native dùng fixture cô lập, không gửi mutation tới backend thật. Đây là bằng chứng mạnh cho source hiện tại nhưng không phải lời bảo đảm tuyệt đối cho mọi firmware/OEM; checklist thiết bị vật lý nằm trong `mobile-staff-android-compatibility.md`.

## Bàn giao

- [Gallery toàn bộ màn/trạng thái Staff](screenshots/mobile-staff/index.html)
- [Ảnh kiểm thử Android native](screenshots/mobile-staff-native/index.html)
- [Ma trận tương thích](screenshots/mobile-staff-compatibility/index.html)
- [Bộ ảnh ZIP](screenshots/mobile-staff.zip)

Các lệnh tái kiểm tra chính:

```sh
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test:staff
node apps/mobile/tests/staff-native-server.mjs --self-test
node apps/mobile/tests/staff-smoke.mjs
node apps/mobile/tests/staff-compatibility.mjs
node apps/mobile/tests/staff-native-build.mjs
```

`staffValidation` là variant kiểm thử x86_64, package `com.giaunh.urbanmind.staffvalidation`, minSdk 24, targetSdk 36, test-only/debug-signed và trỏ tới fixture loopback; không phải APK production để phát hành.
