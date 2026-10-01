# Staff mobile — Android compatibility evidence

Audit date: 2026-09-07. Phạm vi: UI/flow Staff, safe-area, navigation bar, font scale, IME, responsive layout và APK local. Đây là kết quả kiểm thử có giới hạn, không phải lời bảo đảm tuyệt đối cho mọi Android OEM/firmware/keyboard.

## Thiết kế tương thích

- App dùng `react-native-safe-area-context`; header, tab content và detail content có quyền sở hữu inset rõ ràng để không cộng bottom inset hai lần.
- Bottom navigation dùng `BottomTabBar` chuẩn của React Navigation để hệ thống phân bố đều 5 destination/hitbox trên native. Label riêng tối đa hai dòng, giới hạn fixed-chrome ở 1,4×; nội dung màn vẫn theo toàn bộ font scale hệ thống.
- Tab bar ẩn khi IME mở. Màn chat dùng keyboard resize/controller nên field đang focus và nút gửi nằm trên bàn phím.
- Content có gutter theo width, scroll dọc, tablet readable width tối đa 760dp và hỗ trợ inset trái/phải bất đối xứng.
- `app.json`/manifest dùng portrait, edge-to-edge và `adjustResize`. Browser landscape chỉ là stress test, không phải cam kết cho phép xoay native.
- Touch target tab tối thiểu 48dp; loading/error/empty/disabled và accessibility label được cung cấp cho các control chính.

## Kết quả tự động

| Lớp kiểm thử | Kết quả |
| --- | --- |
| Staff unit/contract/layout | 44/44 PASS |
| Mobile + Shared API + web helper (bộ chọn lọc) | 76/76 PASS |
| Axios refresh/session | 6/6 PASS |
| Native fixture contract | 114 assertions PASS |
| Browser baseline 390 × 844 | 131 ảnh, 316 request, 131 geometry checks, 0 lỗi |
| Browser matrix 7 profile | 245 ảnh, 2.212 request, 994 geometry checks, 7/7 PASS |

Các browser profile: 360 × 800, 320 × 640, text lớn, khung gesture, khung 3 nút, 844 × 390 landscape stress và 800 × 1280 tablet. Đây là bằng chứng Expo web tổng hợp; không được diễn giải thành bảy thiết bị Android vật lý.

## APK và native emulator

- Variant: `staffValidation`, test-only/debug-signed, x86_64, package `com.giaunh.urbanmind.staffvalidation`.
- Android: minSdk 24, compile/targetSdk 36; Gradle 8.14.3, AGP 8.11.0, JDK 17, NDK 27.1.12297006.
- Build cuối: `BUILD SUCCESSFUL`, 832 tasks. Script giới hạn một Gradle worker và một CMake worker; init script tạo các đường dẫn staging ngắn để tránh MAX_PATH của CMake/Ninja trong pnpm workspace trên Windows.
- APK: `apps/mobile/android/app/build/outputs/apk/staffValidation/app-staffValidation.apk`, 51.936.964 byte, SHA-256 `f554e4d92f9e8da494452d605a01b571dd031bb66c1bb8eacf78017c7337f07d`.
- Thiết bị quan sát: Pixel 5 AVD, Android 16/API 36, 1080 × 2340, density 440.

Trên đúng APK cuối đã xác nhận:

- Gesture navigation và 3-button navigation: 5 tab/hitbox giãn đều toàn viewport và nằm trên system navigation.
- Android fontScale 2: content reflow/scroll được; fixed tab labels tối đa hai dòng và vẫn truy cập đủ 5 destination.
- Cửa sổ 720 × 1280: tab cuối vẫn nằm trong viewport, content còn cuộn được.
- Gboard + 3-button navigation: chat composer và nút gửi nằm đầy đủ phía trên IME; Android Back đóng IME.
- Account Staff chỉ đọc đúng ranh giới Swagger.
- NeedRework: ảnh cũ, nút xóa toàn bộ, nội dung cảnh báo, nút xác nhận và giữ lại đều tiếp cận được bằng scroll.
- Logcat sau lượt kiểm thử: không có `AndroidRuntime:E` hay `ReactNativeJS:E`.

Gallery bằng chứng: [native Android](screenshots/mobile-staff-native/index.html), [toàn bộ flow browser](screenshots/mobile-staff/index.html), [ma trận responsive](screenshots/mobile-staff-compatibility/index.html).

## Checklist trước production release

APK trên chỉ là artifact kiểm thử fixture, không phải bản ký production. Trước khi phát hành nên chạy cùng test plan trên:

- API 24, 29, 34, 35 và 36; thiết bị RAM thấp và ít nhất một tablet/foldable.
- Samsung One UI, Xiaomi/Redmi HyperOS, Oppo/Realme ColorOS và Android gần-stock; cả gesture lẫn 3 nút.
- Gboard và ít nhất một bàn phím OEM; predictive row, floating keyboard, emoji và gõ tiếng Việt.
- Font 1×/1,5×/2×, display zoom, split-screen, cutout/hole-punch và inset bất đối xứng.
- TalkBack: focus order, selected tab/switch, error announcement, disabled/loading state, file picker cancel/permission denial và hardware/system Back.

Không có hệ thống tự động nào chứng minh “mọi thiết bị Android” theo nghĩa tuyệt đối. Source hiện tại đã loại bỏ các giả định cứng về chiều cao navigation bar và có regression/native evidence cho những rủi ro chính mà yêu cầu nêu ra.
