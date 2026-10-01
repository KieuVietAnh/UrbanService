# Yêu cầu Backend: Staff xử lý Incident và phân công đơn vị xử lý

> Ghi chú cập nhật 01/09/2026: đây là tài liệu yêu cầu lịch sử và toàn bộ phần bên dưới được giữ lại để truy vết quyết định, không còn là danh sách blocker hiện tại. `swagger.json` hiện đã có cập nhật trạng thái Incident, Provider assignment/liên hệ/minh chứng, resolutions theo Incident và SLA status theo Feedback; mobile đã tích hợp bắt đầu xử lý `Assigned → InProgress`, gửi kết quả ban đầu, gửi lại khi `NeedRework` và SLA riêng của từng Feedback/Report. Xem [trạng thái triển khai mobile](../mobile-staff-workspace.md#contract-hiện-tại) để biết contract đang dùng. Backend vẫn thực thi role/ownership/transition cuối cùng; không dùng các endpoint đề xuất lịch sử bên dưới thay cho Swagger và không suy diễn SLA tổng hợp cấp Incident.

## 1. Mục tiêu

Tài liệu này mô tả các contract backend còn thiếu để hoàn thiện hai chức năng của `SYSTEMSTAFF`:

1. Bắt đầu xử lý một Incident đã được Manager phân công.
2. Chọn đơn vị xử lý cho Incident.

Nguyên tắc nghiệp vụ bắt buộc:

- `Incident` là đơn vị công việc mà Staff xử lý.
- `Feedback` là Report của người dân và chỉ cung cấp thông tin cho Incident.
- Không được tự chọn một Feedback bất kỳ làm đại diện cho Incident.
- Staff chỉ được thao tác trên Incident đang được phân công cho chính mình.

## 2. Contract hiện có được xác nhận từ Swagger

### 2.1. Cập nhật trạng thái Incident

Endpoint đã có:

```http
PATCH /api/management/incidents/{incidentId}/status
```

Request hiện tại:

```json
{
  "status": "InProgress",
  "note": "Bắt đầu xử lý sự vụ"
}
```

Response hiện tại được khai báo là `IncidentDetailDto`.

Vấn đề còn thiếu trong Swagger:

- Chưa mô tả role nào được gọi endpoint.
- Chưa có bảng transition trạng thái hợp lệ theo role.
- Chưa xác nhận `SYSTEMSTAFF` được chuyển `Assigned → InProgress`.
- Chưa mô tả cách kiểm tra Staff hiện tại có phải người được phân công hay không.
- Chưa có response `403`, `404`, `409` rõ ràng cho endpoint này.

### 2.2. Provider hiện vẫn thuộc Feedback

Các endpoint hiện tại:

```http
GET  /api/management/feedbacks/{feedbackId}/provider-candidates
POST /api/management/feedbacks/assign
```

`AssignFeedbackRequest` yêu cầu `feedbackId`. `FeedbackProviderReportDto` trả về `providerReportId` và `feedbackId`, nhưng không có `incidentId`.

Backend hiện chưa cung cấp:

- Incident Provider Candidates API.
- Incident Provider Assignment API.
- `representativeReportId`, `primaryReportId` hoặc `executionReportId` có thẩm quyền.
- Quy tắc chính thức chọn Report dùng cho execution khi Incident có nhiều Reports.

Đây là **CRITICAL BE BLOCKER**. Frontend không thể dùng `incident.reports[0]` hoặc tự suy luận một Report đại diện.

## 3. Yêu cầu P0: Cho phép Staff bắt đầu xử lý Incident

### 3.1. Quyền và transition

Backend cần xác nhận và thực thi rule sau:

```text
Role: SYSTEMSTAFF
Điều kiện: JWT userId == Incident.assignedStaffUserId
Transition được phép: Assigned → InProgress
```

Staff không được dùng endpoint này để tự đặt các trạng thái:

- `Approved`
- `NeedRework`
- `Closed`
- `Rejected`
- `Merged`

Không nên chỉ dựa vào frontend để giới hạn transition.

### 3.2. Contract đề nghị

Giữ endpoint hiện tại:

```http
PATCH /api/management/incidents/{incidentId}/status
Authorization: Bearer <SYSTEMSTAFF token>
Content-Type: application/json
```

Request:

```json
{
  "status": "InProgress",
  "note": "Staff bắt đầu xử lý"
}
```

Response thành công:

```http
200 OK
```

Trả về `IncidentDetailDto` đã cập nhật, tối thiểu gồm:

```json
{
  "incidentId": "uuid",
  "status": "InProgress",
  "assignedStaffUserId": "uuid",
  "assignedStaffName": "Nguyễn Văn A",
  "assignedAt": "2026-08-31T08:00:00Z",
  "processingStartedAt": "2026-08-31T09:00:00Z",
  "updatedAt": "2026-08-31T09:00:00Z"
}
```

### 3.3. Error contract cần có

| HTTP | Trường hợp | Mã lỗi đề nghị |
| --- | --- | --- |
| `400` | Status hoặc request không hợp lệ | `INVALID_INCIDENT_STATUS_REQUEST` |
| `403` | Không phải `SYSTEMSTAFF` hoặc không phải Staff đang phụ trách | `INCIDENT_NOT_ASSIGNED_TO_CURRENT_STAFF` |
| `404` | Không tồn tại Incident | `INCIDENT_NOT_FOUND` |
| `409` | Transition không hợp lệ với trạng thái hiện tại | `INVALID_INCIDENT_STATUS_TRANSITION` |

Response lỗi nên có cấu trúc ổn định:

```json
{
  "code": "INVALID_INCIDENT_STATUS_TRANSITION",
  "message": "Không thể chuyển sự vụ từ InProgress sang Assigned.",
  "currentStatus": "InProgress",
  "requestedStatus": "Assigned"
}
```

### 3.4. Timeline và tính nhất quán

Khi chuyển thành công sang `InProgress`, backend cần:

- Cập nhật `processingStartedAt` trong lần bắt đầu đầu tiên.
- Cập nhật `updatedAt`.
- Ghi Incident timeline event, ví dụ `IncidentProcessingStarted`.
- Ghi actor từ JWT thay vì nhận Staff ID từ request.
- Không thay đổi trạng thái của từng Feedback để mô phỏng trạng thái Incident.

## 4. Yêu cầu P0: Provider phải được phân công ở cấp Incident

### 4.1. Entity ownership

Contract mới cần sử dụng `incidentId` làm định danh chính:

```text
Incident
└── IncidentProviderAssignment
    ├── Provider/Coordinator
    ├── Status
    ├── Contact information
    └── Processing records
```

Không yêu cầu frontend gửi `feedbackId` cho thao tác phân công đơn vị xử lý Incident.

### 4.2. API lấy Provider phù hợp

Endpoint đề nghị:

```http
GET /api/management/incidents/{incidentId}/provider-candidates
```

Rule:

- Tìm theo `Incident.areaId` và `Incident.categoryId`.
- Không lấy Area/Category từ Report đầu tiên.
- Chỉ Staff đang phụ trách Incident được sử dụng trong flow phân công.

Response đề nghị:

```json
[
  {
    "coordinatorId": 12,
    "providerId": 8,
    "providerName": "Công ty Công viên Cây xanh",
    "coordinatorName": "Trần Văn B",
    "phoneNumber": "0900000000",
    "email": "provider@example.com",
    "serviceAreaIds": [5],
    "categoryIds": [8]
  }
]
```

Không cần trả workload hoặc availability nếu backend chưa có dữ liệu thật.

### 4.3. API phân công Provider

Endpoint đề nghị:

```http
POST /api/management/incidents/{incidentId}/provider-assignments
```

Request:

```json
{
  "coordinatorId": 12,
  "note": "Kiểm tra và xử lý cây nghiêng"
}
```

Không cần nhận các trường sau từ frontend:

- `feedbackId`
- `staffUserId`
- `incidentId` trong body
- `reportedByUserId`

`incidentId` lấy từ route; Staff lấy từ JWT.

Response đề nghị:

```json
{
  "providerAssignmentId": 101,
  "incidentId": "uuid",
  "coordinatorId": 12,
  "providerId": 8,
  "providerName": "Công ty Công viên Cây xanh",
  "coordinatorName": "Trần Văn B",
  "status": "Assigned",
  "assignedByStaffUserId": "uuid",
  "assignedByStaffName": "Nguyễn Văn A",
  "assignedAt": "2026-08-31T09:15:00Z",
  "updatedAt": "2026-08-31T09:15:00Z"
}
```

### 4.4. API đọc đơn vị đang xử lý

Backend cần chọn một trong hai cách và ghi rõ vào Swagger:

1. Nhúng `providerAssignment` trong `IncidentDetailDto`; hoặc
2. Cung cấp endpoint:

```http
GET /api/management/incidents/{incidentId}/provider-assignments/current
```

Frontend cần tối thiểu:

- ID assignment.
- `incidentId`.
- Tên Provider và Coordinator.
- Thông tin liên hệ.
- Trạng thái.
- Thời gian phân công/cập nhật.

### 4.5. Authorization và lỗi

| HTTP | Trường hợp | Mã lỗi đề nghị |
| --- | --- | --- |
| `403` | Staff không phụ trách Incident | `INCIDENT_NOT_ASSIGNED_TO_CURRENT_STAFF` |
| `404` | Incident/Provider candidate không tồn tại | `INCIDENT_OR_PROVIDER_NOT_FOUND` |
| `409` | Incident đã có đơn vị và chưa cho phép phân công lại | `INCIDENT_PROVIDER_ALREADY_ASSIGNED` |
| `422` | Provider không phù hợp Area/Category | `PROVIDER_NOT_ELIGIBLE_FOR_INCIDENT` |

Backend phải tự kiểm tra eligibility. Frontend chỉ hiển thị candidates và không phải lớp bảo mật.

### 4.6. Timeline

Khi phân công thành công, ghi Incident timeline event, ví dụ:

```text
IncidentProviderAssigned
```

Event nên chứa:

- Incident ID.
- Provider assignment ID.
- Provider/Coordinator.
- Staff thực hiện từ JWT.
- Timestamp.

## 5. Quyết định backend cần xác nhận

Trước khi hoàn thiện Provider flow, backend/product cần trả lời:

1. Một Incident có tối đa một Provider assignment đang hoạt động hay có thể có nhiều đơn vị đồng thời?
2. Có cho phép Staff thay đổi đơn vị xử lý không? Nếu có, transition và audit log là gì?
3. Provider Report sẽ chuyển hoàn toàn sang `incidentId`, hay backend sẽ duy trì cả `feedbackId` và `incidentId` trong giai đoạn migration?
4. Provider status là trạng thái riêng hay làm thay đổi trực tiếp Incident status?
5. Khi Incident được gộp, Provider assignment đang hoạt động được chuyển sang Incident đích như thế nào?

Nếu backend tạm thời bắt buộc giữ API theo Feedback, backend phải cung cấp một `executionReportId` có thẩm quyền trong `IncidentDetailDto`. Frontend không tự suy luận trường này. Đây chỉ là giải pháp migration; contract Incident-level vẫn là hướng ưu tiên.

## 6. Acceptance checklist cho Backend

### Bắt đầu xử lý

- [ ] `SYSTEMSTAFF` được phép chuyển đúng `Assigned → InProgress`.
- [ ] Chỉ Staff đang được phân công mới thực hiện được.
- [ ] Transition khác bị từ chối ở backend.
- [ ] Response trả Incident mới nhất.
- [ ] Có `assignedAt` và `processingStartedAt`.
- [ ] Timeline ghi đúng actor và timestamp.
- [ ] Swagger mô tả role, transition và error responses.

### Đơn vị xử lý

- [ ] Candidates được truy vấn bằng `incidentId`.
- [ ] Assignment được tạo bằng `incidentId`, không yêu cầu frontend chọn Feedback.
- [ ] Eligibility dùng Area + Category của Incident.
- [ ] Response có `providerAssignmentId` và `incidentId`.
- [ ] Có contract đọc đơn vị đang xử lý.
- [ ] Authorization kiểm tra Staff đang phụ trách.
- [ ] Timeline được cập nhật.
- [ ] Swagger mô tả đầy đủ request, response và error responses.

## 7. Evidence trong code hiện tại

- `swagger.json`: endpoint Incident status tại dòng khoảng `6006`.
- `swagger.json`: Feedback provider candidates tại dòng khoảng `4387`.
- `swagger.json`: Feedback provider assignment tại dòng khoảng `5248`.
- `swagger.json`: `AssignFeedbackRequest` tại dòng khoảng `14775`.
- `swagger.json`: `FeedbackProviderReportDto` tại dòng khoảng `15869`.
- `swagger.json`: `UpdateIncidentStatusRequest` tại dòng khoảng `19044`.
- Frontend capability/blocker: `packages/shared-api/src/incidentManagementApi.js`.
- Staff processing UI: `apps/web/src/pages/staff/StaffIncidentProcessingPanel.jsx`.
