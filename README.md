# 🏙️ UrbanMind — Capstone Project (SEP491)

> **Hệ thống quản lý phản ánh và dịch vụ đô thị thông minh**  
> Urban Service Interaction & Feedback Platform

---

## 📌 Giới thiệu dự án

**UrbanMind** là nền tảng cho phép người dân (`Citizen`) phản ánh các vấn đề đô thị (hư hỏng đường, ngập nước, rác thải, …), đội ngũ hỗ trợ (`Helper`) nhận và xử lý phản ánh, và các cấp quản lý (`Inspector`, `Admin`, `Department Head`) giám sát toàn bộ hệ thống thông qua dashboard phân tích dữ liệu.

| Thông tin | Chi tiết |
|-----------|----------|
| Mã đồ án | SU26SE058 |
| Học kỳ | Summer 2026 |
| Nền tảng | Web (React) + Mobile (React Native/Expo) |
| Deploy Web | Vercel |
| Deploy Mobile | Expo EAS Build / TestFlight / APK |

---

## 🏗️ Kiến trúc Monorepo

Dự án sử dụng **pnpm Workspaces** (Monorepo) để quản lý nhiều ứng dụng trong cùng một repository.

```
SEP491/
├── apps/
│   ├── web/                        # ✅ React + Vite (Web App)
│   └── mobile/                     # 📱 React Native + Expo (Mobile App)
│
├── packages/
│   └── common/                     # 📦 Shared logic (utils, constants, types)
│       └── index.js
│
├── package.json                    # Root workspace scripts
├── pnpm-workspace.yaml             # Workspace registration
├── .gitignore
└── README.md
```

---

## 📁 Cấu trúc chi tiết `apps/web`

```
apps/web/
├── public/                         # Static assets
├── src/
│   ├── assets/                     # Images, icons, fonts
│   ├── components/
│   │   ├── charts/                 # Chart components (Recharts)
│   │   ├── layout/                 # Header, Sidebar, Layout wrappers
│   │   └── maps/                   # Map components (Leaflet / Google Maps)
│   │
│   ├── contexts/                   # React Context (AuthContext, ThemeContext, …)
│   ├── guards/                     # Route Guards (PrivateRoute, RoleGuard)
│   ├── pages/
│   │   ├── LandingPage.jsx         # Trang chủ public
│   │   ├── auth/                   # Login, Register, ForgotPassword
│   │   ├── dashboard/              # Dashboard theo từng role
│   │   ├── tickets/                # Danh sách, tạo mới, chi tiết phản ánh
│   │   ├── management/             # Quản lý user, phân công
│   │   ├── analytics/              # Báo cáo thống kê
│   │   ├── community/              # Forum, bình luận cộng đồng
│   │   ├── profile/                # Trang cá nhân
│   │   ├── settings/               # Cài đặt tài khoản
│   │   └── admin/                  # Admin panel
│   │
│   ├── roles/                      # Role-specific logic/constants
│   ├── routes/                     # React Router config
│   ├── services/                   # API service layer (axios calls)
│   ├── store/                      # State management (Zustand / Redux)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── index.html
├── package.json
└── vite.config.js
```

---

## 📁 Cấu trúc chi tiết `apps/mobile`

> ⚠️ Mobile chỉ hỗ trợ **2 roles**: `Citizen` và `Helper`

```
apps/mobile/
├── App.js                          # Entry point Expo
├── package.json
└── (Sẽ mở rộng khi có Figma mobile)
    ├── src/
    │   ├── screens/
    │   │   ├── citizen/            # Màn hình cho Citizen
    │   │   └── helper/             # Màn hình cho Helper
    │   ├── navigation/             # React Navigation stack/tab
    │   ├── services/               # API calls (dùng chung với web nếu có thể)
    │   ├── contexts/               # Auth, Theme context
    │   └── components/             # Reusable UI components
    └── assets/
```

---

## 👥 Các Role trong hệ thống

| Role | Nền tảng | Quyền hạn |
|------|----------|-----------|
| `citizen` | Web + Mobile | Gửi phản ánh, theo dõi trạng thái |
| `helper` | Web + Mobile | Nhận & xử lý phản ánh được giao |
| `inspector` | Web only | Kiểm tra chất lượng xử lý |
| `department_head` | Web only | Quản lý phòng ban, phân công |
| `admin` | Web only | Quản trị toàn hệ thống |

### 🖥️ Layout theo role (Web)

- **Citizen**: Navbar ngang (horizontal) — Không có sidebar
- **Các role còn lại**: Sidebar dọc + Header ngang

---

## 🔌 Tích hợp Backend API

### Base URL
```
Development:  http://localhost:8080/api
Production:   https://api.urbanmind.io/api   (cập nhật sau)
```

### Authentication
- Sử dụng **JWT Bearer Token**
- Token được lưu trong `localStorage` key: `token`
- Refresh token flow: chưa implement (TODO)
- Header format:
```
Authorization: Bearer <access_token>
```

### File cấu hình môi trường

Tạo file `.env` tại `apps/web/`:
```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

Tạo file `.env` tại `apps/mobile/`:
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

> ⚠️ **KHÔNG commit file `.env` lên GitHub!**

### Services Layer (apps/web/src/services/)

Các API call được tổ chức theo module:

```
services/
├── authService.js          # POST /auth/login, /auth/register, /auth/logout
├── ticketService.js        # CRUD /tickets
├── userService.js          # GET/PUT /users, /users/me
├── departmentService.js    # GET /departments
├── analyticsService.js     # GET /analytics/summary, /analytics/tickets
└── api.js                  # Axios instance với interceptors
```

### Các API Endpoints cần thiết (Backend cần implement)

#### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/auth/login` | Đăng nhập, trả về JWT |
| POST | `/auth/register` | Đăng ký tài khoản Citizen |
| POST | `/auth/logout` | Đăng xuất |
| GET | `/auth/me` | Lấy thông tin user hiện tại |

#### Tickets (Phản ánh)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/tickets` | Danh sách phản ánh (filter, sort, pagination) |
| POST | `/tickets` | Tạo phản ánh mới |
| GET | `/tickets/:id` | Chi tiết phản ánh |
| PUT | `/tickets/:id` | Cập nhật phản ánh |
| PATCH | `/tickets/:id/status` | Cập nhật trạng thái |
| DELETE | `/tickets/:id` | Xóa phản ánh |
| POST | `/tickets/:id/assign` | Phân công Helper |
| POST | `/tickets/:id/comments` | Thêm bình luận |

#### Users
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/users` | Danh sách user (Admin only) |
| GET | `/users/:id` | Chi tiết user |
| PUT | `/users/:id` | Cập nhật thông tin |
| PATCH | `/users/:id/role` | Đổi role (Admin only) |

#### Analytics
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/analytics/summary` | Tổng quan thống kê |
| GET | `/analytics/tickets` | Thống kê phản ánh theo thời gian |
| GET | `/analytics/by-category` | Thống kê theo danh mục |
| GET | `/analytics/by-area` | Thống kê theo khu vực |

---

## 🚀 Hướng dẫn cài đặt & chạy

### Yêu cầu hệ thống
- Node.js >= 18.x
- pnpm >= 8.x (hoặc npm >= 9.x)

### Cài đặt

```bash
# Clone repository
git clone https://github.com/<your-org>/urbanmind.git
cd urbanmind

# Cài đặt dependencies cho toàn bộ monorepo
npm install
# hoặc
pnpm install
```

### Chạy development

```bash
# Chạy Web app
npm run dev:web
# → http://localhost:5173

# Chạy Mobile app (cần Expo CLI và Expo Go app trên điện thoại)
npm run dev:mobile
# → Scan QR code bằng Expo Go
```

### Build production

```bash
# Build Web
npm run build:web
# → Output: apps/web/dist/
```

---

## ☁️ Deployment

### Web — Vercel

1. Kết nối GitHub repo với [Vercel](https://vercel.com)
2. Cấu hình:
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Thêm Environment Variables trên Vercel dashboard
4. Auto-deploy khi push lên branch `main`

### Mobile — Expo EAS Build

```bash
# Cài đặt EAS CLI
npm install -g eas-cli

# Đăng nhập Expo
eas login

# Build APK (Android)
cd apps/mobile
eas build --platform android --profile preview

# Build cho iOS (cần Apple Developer Account)
eas build --platform ios
```

---

## 🌿 Git Workflow

### Branch Strategy

```
main              ← Production (Web deploy tự động)
├── develop       ← Integration branch
│   ├── feature/citizen-ui
│   ├── feature/ticket-management
│   ├── feature/analytics-dashboard
│   ├── fix/auth-token-expiry
│   └── chore/monorepo-setup
```

### Commit Convention (Conventional Commits)

```
feat: thêm tính năng tạo phản ánh
fix: sửa lỗi token không hợp lệ
chore: cập nhật dependencies
style: chỉnh CSS layout Citizen
refactor: tách service layer
docs: cập nhật README
```

---

## 🧪 Test Accounts (Development)

> Yêu cầu Backend seed sẵn dữ liệu này vào database dev:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@urbanmind.io | Admin@123 |
| Department Head | dept@urbanmind.io | Dept@123 |
| Inspector | inspector@urbanmind.io | Inspect@123 |
| Helper | helper@urbanmind.io | Helper@123 |
| Citizen | citizen@urbanmind.io | Citizen@123 |

---

## 🤝 Phân công team

| Thành viên | Nhiệm vụ |
|------------|----------|
| Frontend Web | React + Vite (`apps/web`) |
| Frontend Mobile | React Native + Expo (`apps/mobile`) |
| Backend | Spring Boot / Node.js API |
| Database | ERD, Migration, Seeding |

---

## 📞 Liên hệ & Tài liệu

- 📄 API Specification: `API Specification.docx` (trong repo)
- 📊 ERD: `ERD/` folder
- 📋 SRS: `Report3_Software Requirement Specification.docx`
- 🎨 Figma Design: Liên hệ team Frontend để nhận link

---

*Last updated: June 2026 — SU26SE058 UrbanMind Team*
