# UrbanService Fullstack

Monorepo triển khai chung backend ASP.NET Core và frontend UrbanMind bằng một
GitHub Actions workflow.

## Cấu trúc

```text
backend/                         ASP.NET Core API, test và Dockerfile
frontend/                        pnpm workspace cho web và mobile
.github/workflows/deploy.yml     Workflow CI/CD duy nhất
docker-compose.prod.yml          Cấu hình chạy API production
```

Hai repository gốc không bị thay đổi. Thư mục này là bản sao đã loại bỏ `.git`,
`node_modules`, build output, log và các workflow cũ.

## Chạy local

Backend:

```bash
cd backend
dotnet restore UrbanService.sln
dotnet run --project UrbanService/UrbanService.csproj
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev:web
```

## CI/CD chung

Workflow `.github/workflows/deploy.yml` chạy khi push lên `main` hoặc khi chạy
thủ công. Một lần chạy sẽ:

1. Restore, build và test backend.
2. Install, test, lint và build frontend với biến production.
3. Build Docker image cho API và đóng gói web static.
4. Upload cả hai gói lên cùng VPS.
5. Khởi động lại API, đồng bộ web vào thư mục Nginx và reload Nginx.
6. Health check API, frontend và chạy Playwright smoke test production.

Không đặt thêm workflow trong `backend/.github` hoặc `frontend/.github`. Mọi thay
đổi CI/CD phải được thực hiện tại workflow root.

## GitHub Secrets

VPS:

- `DO_HOST`, `DO_USER`, `DO_SSH_KEY`, `DO_PORT`

Frontend build:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Backend bắt buộc:

- `DB_CONNECTION_STRING`
- `JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- `GOOGLE_AUTH_CLIENT_ID`, `CORS_ALLOWED_ORIGINS`
- Các secret PayOS, AI/OpenRouter, Messenger, Firebase và Zalo đang được backend sử dụng

Các giá trị giới hạn hoặc feature flag có thể cấu hình bằng GitHub Actions
Variables như trong workflow. `FIREBASE_SERVICE_ACCOUNT_JSON` nên được lưu dưới
dạng JSON một dòng để tương thích file `.env` của Docker Compose.

## Thư mục production trên VPS

- API và file deploy: `/var/www/urban-service`
- Web static được Nginx phục vụ: `/var/www/urban-service-fe`
- API health check nội bộ: `http://localhost:8080/health`
- Frontend production: `https://urbanservice.me`

