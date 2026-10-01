# 🏙️ UrbanMind — Capstone Project

> Frontend này hiện nằm trong monorepo `UrbanService-Fullstack`. CI/CD và deploy
> production được quản lý duy nhất tại `../.github/workflows/deploy.yml`; không tạo
> workflow riêng trong thư mục frontend.

> **Hệ thống quản lý phản ánh và dịch vụ đô thị thông minh**

---

## 📌 Giới thiệu dự án

UrbanMind là nền tảng giúp người dân phản ánh sự cố đô thị (đèn đường hỏng, ngập nước, rác thải, cây ngã, …), cho phép đội kỹ thuật và quản lý theo dõi, xử lý và đánh giá tiến trình xử lý qua dashboard.

---

## 🌐 Deploy hiện tại

- Frontend: `https://urbanservice.me`
- Backend Swagger UI: [https://api.urbanservice.me/swagger/index.html](https://api.urbanservice.me/swagger/index.html)

---

## 🏗️ Kiến trúc Monorepo

Dự án sử dụng **pnpm Workspaces** để quản lý nhiều package và ứng dụng trong cùng repository.

```
UrbanService-FE/
├── apps/
│   ├── web/                        # React + Vite frontend
│   └── mobile/                     # Expo React Native mobile app
├── packages/
│   ├── common/                     # Shared logic và helper chung
│   ├── shared-api/                 # API wrapper dùng chung
│   ├── shared-types/               # Định nghĩa kiểu dữ liệu và role mapping
│   ├── shared-ui/                  # UI component chung
│   └── shared-utils/               # Utility functions chung
├── package.json                    # Root workspace scripts
├── pnpm-workspace.yaml             # Workspace registration
└── README.md
```

---

## 📁 Cấu trúc `apps/web`

```
apps/web/
├── public/                         # Static assets
├── src/
│   ├── api/                        # Shared API config và axios wrapper
│   ├── assets/                     # Images, icons, media files
│   ├── components/                 # UI components tái sử dụng
│   │   ├── charts/                 # Biểu đồ
│   │   ├── layout/                 # Header, Sidebar, Layout wrappers
│   │   └── maps/                   # Map components (Leaflet)
│   ├── contexts/                   # React context (Auth, state, ...)
│   ├── guards/                     # Route guards (RoleGuard, ProtectedRoute)
│   ├── hooks/                      # Custom hooks
│   ├── pages/                      # Pages theo route
│   ├── roles/                      # Role-specific config
│   ├── routes/                     # App route definitions
│   ├── services/                   # API service layer
│   ├── store/                      # State management
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.js
```

---

## 📁 Cấu trúc `apps/mobile`

```
apps/mobile/
├── App.js                          # Entry point Expo
├── package.json
└── (cấu trúc mở rộng theo nhu cầu mobile)
```

---

## 📁 Cấu trúc `packages`

```
packages/
├── common/                        # Shared helper logic và constants
├── shared-api/                    # API wrapper chung cho client
├── shared-types/                  # Kiểu dữ liệu chung và role mapping
├── shared-ui/                     # Shared UI components
└── shared-utils/                  # Utility functions chung
```

---

## 👥 Các role chính

| Role nội bộ | Miêu tả |
|-------------|--------|
| `service-user` | Người dân phản ánh và theo dõi ticket |
| `service-provider` | Đội kỹ thuật xử lý ticket |
| `interaction-manager` | Quản lý tương tác và giám sát |
| `administrator` | Quản trị viên hệ thống |
| `system-staff` | Nhân viên hệ thống nội bộ |

---

## 🔌 Backend API

### Deploy hiện tại
- Frontend: `https://urbanservice.me`
- Backend Swagger UI: `https://api.urbanservice.me/swagger/index.html`

### Base URL môi trường
- Local development: `http://localhost:8080/api`
- Production backend: `https://api.urbanservice.me/api`

### Cấu hình môi trường

Tạo file `.env` tại `apps/web/`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Tạo file `.env` tại `apps/mobile/`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

> ⚠️ **KHÔNG commit file `.env` lên GitHub**

---

## 🚀 Cài đặt & chạy

### Yêu cầu
- Node.js >= 18
- pnpm >= 8

### Cài đặt

```bash
git clone https://github.com/<your-org>/UrbanService-FE.git
cd UrbanService-FE
pnpm install
```

### Chạy ứng dụng

```bash
pnpm dev:web
# Mở http://localhost:5173
```

```bash
pnpm dev:mobile
# Khởi chạy Expo trong terminal, mở QR code và dashboard Expo
```

```bash
pnpm dev:mobile:android
# Khởi chạy Expo và tự động mở app trên Android emulator nếu đã cài đặt và cấu hình
```

### Build web

```bash
pnpm build:web
# Output: apps/web/dist/
```

---

## 🧩 Root scripts

| Lệnh | Mô tả |
|------|-------|
| `pnpm dev` | Chạy web app tại `apps/web` |
| `pnpm dev:web` | Chạy Web frontend |
| `pnpm dev:mobile` | Chạy Mobile app |
| `pnpm build:web` | Build Web app |

---

## 📌 Lưu ý dự án

- `apps/web` là frontend chính dùng React + Vite.
- `packages/shared-api` chứa các API wrapper chung.
- `packages/shared-types` chứa các loại dữ liệu và helper chung.
- `apps/mobile` là Expo mobile app, đang ở trạng thái khởi tạo.
- Deploy frontend hiện tại tại: `https://urbanservice.me`.
- Backend Swagger UI: `https://api.urbanservice.me/swagger/index.html`.
