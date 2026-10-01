# Phase 14 — Native Runtime Smoke Validation

## 1. Environment

| Item | Value |
| --- | --- |
| Date | 2026-08-15 (Asia/Saigon) |
| Git branch | `giaunh` |
| Commit | `872d654` |
| Initial mobile working tree | Clean (`git status --short -- apps/mobile` returned no entries) |
| Host OS | Windows NT 10.0, build 26200 |
| Node / pnpm | Node `v24.19.0`; pnpm `10.34.2` |
| Device | Android Emulator `Pixel_5`, serial `emulator-5554`, x86_64 |
| Android | Android 16 / API 36 |
| Runtime client | Expo Go (`host.exp.exponent`) |
| Expo / React Native | Expo SDK `~54.0.36`; React Native `0.81.5`; Expo Router `~6.0.24` |
| API base URL | `https://api.urbanservice.me` |
| Test account | Existing service-user fixture from the repository; credentials and tokens are intentionally omitted |

The repository-supported command was `pnpm run android` (`expo start --android`). The first attempt reached Metro but Expo CLI failed during its dependency-version check with `TypeError: Body is unusable: Body has already been read`. Runtime testing continued without changing files by setting the process-local variable `EXPO_NO_DEPENDENCY_VALIDATION=1`.

No source correction, dependency change, native regeneration, EAS change, or `apps/web` modification was made.

## 2. Smoke Test Matrix

| Flow | Status | Runtime evidence |
| --- | --- | --- |
| Startup | PASS | Clean launch showed the UrbanMind splash and then a valid login screen. Warm reopen worked. No red screen, fatal Metro error, missing module, or font/asset failure was observed. |
| Authentication | PASS | Login fields accepted input; invalid credentials returned `Unauthorized.`; the repository service-user fixture logged in and routed to the resident Home screen in approximately 6 seconds. No auth navigation loop occurred. |
| Session restoration | PASS | After leaving and reopening the Expo experience, the authenticated session and Inbox route were restored. After logout, reopen remained on Login. |
| Home | PASS | Header, resident identity, hero, quick report action, nearby incidents, native map preview, community/ticket sections, chat FAB, scrolling, and API data rendered. Location denial did not crash Home. |
| Create report | PARTIAL | Steps 1–4 were exercised through review: validation, title/description draft, area selection, native-map point selection, duplicate check, attachment preview, and review summary worked. Submission, success navigation, and resulting-ticket verification were deliberately not performed. |
| Location permission | PARTIAL | Android first-request prompt, denied state, re-entry without an automatic loop, package-level grant, and Expo-experience coarse/fine prompts were exercised. Native maps and manual coordinate selection worked. `Current location` did not populate coordinates even after an emulator GPS fix; see RT-004. |
| Camera/media permission | PASS | Android photo picker opened and returned a selected smoke-test screenshot. Camera first request appeared; deny returned safely; re-entry prompted only after another explicit action; grant opened the camera activity; cancel returned to the wizard with the existing attachment intact. |
| Ticket list | PASS | `Phản ánh của tôi` loaded 15 items with filters and cards. A card opened the correct detail record. |
| Ticket detail | PASS | Correct title, status, priority, timestamp, four-step timeline, content, coordinates, map, and support controls rendered. No route-parameter or loading failure was observed. |
| Ticket native map | PASS | Google Map rendered inside ticket detail with marker coordinates `10.84980, 106.78702` and map actions. |
| Community feed | PASS | Feed header, search, summary counts, filters, cards, statuses, and API content rendered. |
| Community native map | PASS | Google Map, region selector, incident list, locate control, and native map route rendered without a native-module error. Marker/map movement did not crash. |
| Inbox | PARTIAL | AI and support lists loaded, empty/new-chat entry existed, and content appeared within about 5 seconds. Initial and cached re-entry both unnecessarily obscured the screen with loading overlays; see RT-002. |
| New AI conversation | PARTIAL | Entering new chat showed a local empty/greeting state and composer without sending a message. Leaving without a first message did not add an obvious new Inbox item. First-message conversation creation and deduplication were not tested. |
| Existing AI conversation | PARTIAL | Existing history, timestamps, composer, keyboard input, and in-app back control rendered. A local draft was entered but not sent. AI response, send deduplication, and reopen-after-send were not tested. |
| Staff/support conversation | PARTIAL | Support list loaded three records; an existing conversation opened with history and composer. No message was sent. The ticket-detail chat CTA itself is inaccessible; see RT-001. |
| Realtime messaging | NOT TESTED | No outgoing message or second device/session was used, so connect/reconnect, incoming delivery, listener duplication, reconciliation, and background recovery cannot be claimed. No socket error appeared in the sampled log while support chat was open. |
| Notifications | PARTIAL | List, filters, unread count, and read mutation worked (`6` unread became `5`). The tested item stayed on Notifications instead of opening its ticket; see RT-005. External push delivery was not tested. |
| Profile | PASS | Resident data, activity counts, account/help actions, and logout control rendered. Runtime ownership remains in the Expo route rather than the mostly empty `src/features/profile` boundary. |
| Logout | PASS | Confirmation appeared; logout returned to Login; reopening the Expo experience remained unauthenticated. |
| Expo Router navigation | PARTIAL | Auth, resident Home, report wizard, ticket list/detail, community/feed/map, Inbox, new/existing AI, support, notifications, and profile routes rendered without route-not-found screens. Ticket feedback-chat navigation is blocked by overlapping UI (RT-001). Direct `[id]/chat`, review, and all parameter variants were not independently exercised. |

## 3. Runtime Issues

### RT-001 — Ticket chat CTA is covered by the resident bottom navigation

| Field | Detail |
| --- | --- |
| Severity | HIGH |
| Flow | Ticket detail → feedback/support chat |
| Observed behavior | The `Trao đổi` button is visually present but its entire hit area overlaps the resident bottom navigation. A center tap opened the report wizard; a left-side tap was handled by the Home tab. The ticket chat could not be opened through this CTA. |
| Expected behavior | Tapping `Trao đổi` should open `/(resident)/tickets/[id]/chat`. |
| Reproduction | Login → Home → open nearby ticket `Hj` → scroll to the bottom CTA → tap `Trao đổi`. |
| Probable root cause | The detail action has accessibility bounds `[55,2131][1025,2274]`, while bottom tabs occupy approximately `[11,2117][1069,2261]`. The tab layer has the effective hit priority/z-order. |
| Evidence | Center tap routed to `create-feedback-wizard`; the CTA and tab bounds were read from the native accessibility tree. |
| Recommended future phase | Targeted mobile UI/navigation reliability fix. Move/pad the CTA above the tab bar or correct safe-area/z-index handling; then add a native regression test for `tickets/[id]/chat`. |

### RT-002 — Inbox displays redundant blocking loading overlays

| Field | Detail |
| --- | --- |
| Severity | MEDIUM |
| Flow | Resident Inbox initial entry and cached re-entry |
| Observed behavior | At approximately 0.5 seconds after first entry, the Inbox header/layout was faded under a full-screen overlay while a second AI-tab spinner and `Đang tải hộp thư AI…` state were also visible. Cached re-entry again hid valid content under a blocking spinner before restoring the list. |
| Expected behavior | One coherent loading state should be shown only while no usable content exists; cached content should remain visible during background refresh. |
| Reproduction | Login → tap Inbox → observe immediately and after load → Home → Inbox again. |
| Probable root cause | A screen-level transition/loading overlay and the tab query loading state are active independently. Cached/refetch state appears to trigger the blocking overlay. |
| Evidence | First content was visible within approximately 5 seconds; cached re-entry showed the overlay at 0.7 seconds and restored content within about 3 seconds. No swallowed error was visible. |
| Recommended future phase | Messaging reliability/loading-state phase. Do not change query caching without focused tests. |

### RT-003 — Attachment copy contradicts report validation

| Field | Detail |
| --- | --- |
| Severity | MEDIUM |
| Flow | Report wizard, step 3 |
| Observed behavior | The empty state says `Bạn có thể bỏ qua bước này`, but the `Tiếp theo` button is disabled at `0/5`. Selecting one attachment changes it to enabled. |
| Expected behavior | Copy and validation should agree about whether evidence is optional. |
| Reproduction | Report wizard → valid description/location/area → step 3 with zero attachments. |
| Probable root cause | `validateStep(3)` requires `attachments.length > 0` while the UI copy still describes attachments as skippable. |
| Evidence | Accessibility state reported `Tiếp theo ... enabled=false` at `0/5`, then `enabled=true` at `1/5`. |
| Recommended future phase | Reporting UX/business-rule clarification, followed by one minimal copy or validation correction. |

### RT-004 — Current-location action did not obtain an emulator position

| Field | Detail |
| --- | --- |
| Severity | MEDIUM |
| Flow | Report location picker / permission granted |
| Observed behavior | After Android and Expo-experience coarse/fine permission grants, `Hiện tại` still displayed `Chưa có tọa độ`. Injecting emulator GPS `106.7000, 10.7800` and retrying did not populate the fields. Manual map tap immediately produced `21.016845, 105.834200`. |
| Expected behavior | Current-location action should populate coordinates when permission is granted and an emulator fix exists, or show a durable actionable fallback. |
| Reproduction | Report wizard step 2 → grant both permission layers → inject emulator geo fix → tap `Hiện tại`. |
| Probable root cause | Undetermined. It may be Expo Go/emulator location delivery or the `getCurrentPositionAsync` path. The manual native-map path proves the map and state setters work. |
| Evidence | No fatal/security exception; coordinate labels remained empty after multiple waits. |
| Recommended future phase | Re-test on a physical Android device or development client before changing code. Instrument only the location request/status/result path if reproduced there. |

### RT-005 — Notification read mutation works but tested item does not navigate

| Field | Detail |
| --- | --- |
| Severity | MEDIUM |
| Flow | Notifications → related ticket |
| Observed behavior | Tapping the `Phản ánh đã được tạo` item marked it read (`6` → `5`) but remained on Notifications despite the visible `Xem` affordance. |
| Expected behavior | A ticket-related notification with `Xem` should open its ticket detail. |
| Reproduction | Home bell → Notifications → tap newest unread `Hj` item. |
| Probable root cause | The handler only routes when `item.relatedId` exists. The API payload appears to omit `relatedId`/`feedbackId` for this item. |
| Evidence | Read mutation completed and the unread badge changed, proving the press handler ran; route did not change. |
| Recommended future phase | Notification payload contract and routing validation. Keep the existing Router path until the backend payload is verified. |

### RT-006 — Expo CLI dependency check fails before Android launch

| Field | Detail |
| --- | --- |
| Severity | INFORMATIONAL |
| Flow | Local Android development startup |
| Observed behavior | Plain `pnpm run android` started Metro, then exited with `TypeError: Body is unusable: Body has already been read` in Expo CLI native-module version validation. |
| Expected behavior | Repository Android script should open the project without a CLI exception. |
| Reproduction | From `apps/mobile`, run `pnpm run android` in this environment. |
| Probable root cause | Expo CLI remote dependency-version response handling under the current Node/environment, before app source execution. |
| Evidence | Process-local `EXPO_NO_DEPENDENCY_VALIDATION=1` allowed the same script to launch; TypeScript, lint, runtime bundle, and final production export passed. |
| Recommended future phase | Developer-environment/tooling investigation. No application source fix is indicated. |

### RT-007 — Expo Go update cache failed after permission reset

| Field | Detail |
| --- | --- |
| Severity | INFORMATIONAL |
| Flow | Expo Go test environment |
| Observed behavior | After permission reset and a manual project deep link, Expo Go showed `Uncaught Error: java.io.IOException: Failed to download remote update`. |
| Expected behavior | Expo Go should reload the local experience. |
| Reproduction | Reset Expo Go location permission, reload using a manually constructed local Expo URL. |
| Probable root cause | Expo Go remote-update/cache state or the manually constructed development URL, not an application JavaScript exception. |
| Evidence | Clearing only Expo Go app data and relaunching through the repository workflow restored splash/login and all subsequent testing. |
| Recommended future phase | Environment documentation only unless it reproduces in a development client. |

## 4. Network / Realtime Observations

- API initialization targeted `https://api.urbanservice.me`.
- Invalid login returned a handled `Unauthorized.` UI state; valid login and resident API data succeeded.
- Home, community, tickets, ticket detail, Inbox AI/support lists, and notifications returned usable data.
- Inbox initial data became visible within approximately 5 seconds; cached re-entry still blocked content for roughly 3 seconds (RT-002).
- Report location-next invoked the existing duplicate-check path and reached the attachment step.
- No report, AI message, or support message was submitted, so request deduplication and optimistic/server reconciliation were not measured.
- No obvious duplicate API request could be proven from the available Metro/logcat output. No N+1 claim is made.
- No socket error appeared in sampled logcat while a support conversation was open. Connection, reconnect, incoming events, duplicate listeners, and stale subscriptions remain NOT TESTED because no second session or outgoing message was used.
- The notification read mutation succeeded, while related navigation did not (RT-005).

## 5. Native-Specific Findings

| Area | Finding |
| --- | --- |
| Map rendering | Home preview, report picker, ticket detail, and community map rendered with `react-native-maps`/Google Map; no native-module leakage or `requireNativeComponent` failure was observed. |
| Map interaction | Community map remained stable during movement. Report map tap created a marker coordinate. A Home-map gesture can pan the map rather than scroll the parent, so edge scrolling was needed during automation; no crash resulted. |
| Location | Android denial was safe and did not auto-loop. Expo Go adds per-experience coarse/fine permission dialogs after package grant. Manual map selection works; current-position acquisition needs physical-device/development-client confirmation (RT-004). |
| Camera | Denied and granted paths were exercised. Grant opened the camera (`Options`, `Shutter`); cancel returned safely. |
| Media picker | Android system Photo Picker opened with selected-photo-only access; a test screenshot returned to the app and rendered as `1/5`. |
| Keyboard | Login inputs and AI/report draft inputs accepted text. A local AI draft was not sent. Automated `KEYCODE_BACK` timing sometimes closed the Expo experience rather than only the keyboard, so Android-back conclusions are conservative. |
| Back button | In-app `Quay lại` controls worked. Two rapid Android Back actions during chat exited to Expo Go Home; because keyboard visibility was not observed between actions, this is not classified as an app regression. |
| Foreground/background | Leaving and reopening from Expo Go Recently Opened restored the authenticated Inbox route. After logout it restored Login. |
| Expo Go environment | One remote-update cache failure and one ADB server hang occurred during automation. Both were recovered without source changes and are not classified as application crashes. |

## 6. Dead-Code Safety Findings

- **Legacy messaging chain:** Runtime entry points used `InboxHubScreen`/active AI and support conversation implementations. No runtime path entered `legacy-inbox-screen`, `conversation-list`, `useConversations`, `useMessages`, or `useMessageQueue`. This supports, but does not by itself prove, the existing dead-code classification. Do not delete until the HIGH ticket-chat navigation regression is fixed and active messaging send/realtime tests pass.
- **Reporting duplicate components:** The active wizard, inline ticket list card, active ticket detail timeline/status UI, and native reporting map paths were exercised. No route consumed the reported duplicate standalone reporting components. Runtime evidence supports the report's recommendation to compare before later cleanup.
- **Shared isolated components:** No exercised route used `ActionSheet`, `AppModal`, `AppScreen`, `CommunicationHub`, or the regression harness. This does not contradict `DEAD_CODE_REPORT.md`; static evidence remains the primary basis.
- **Duplicate map implementations:** Android resolved native map implementations successfully. `community-map.web.tsx` was not used by Android and must remain untouched until the later web consolidation decision.
- **Profile boundary:** Profile runtime behavior remains implemented by the Expo route while `src/features/profile` has little active ownership, matching the prior structural observation.

No dead-code candidate was removed or modified.

## 7. Final Static Re-validation

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit --pretty false` | PASS |
| `pnpm run lint` | PASS with `0` errors and `270` warnings (baseline unchanged) |
| `pnpm exec expo export --platform web` | PASS; 1,567 modules bundled and Router web metadata/output generated |
| Temporary export output | `apps/mobile/dist` was confirmed ignored and removed after validation |
| Source changes | None |
| Unrelated `apps/web` changes | None made |

## 8. Readiness Decision

**BLOCKED**

Blocking runtime regression:

- RT-001: the ticket-detail `Trao đổi` CTA is inaccessible because the resident bottom navigation fully overlaps its hit area, preventing the supported ticket feedback-chat route from being opened through the UI.

Additional validation still required after the targeted fix:

- Report submission/success/result ticket on a disposable test record.
- First-message AI conversation creation and duplicate prevention.
- Existing AI/support outgoing send, failure reconciliation, history restore, and realtime reconnect/incoming behavior.
- Current-location behavior on a physical Android device or development client.
- External push delivery.

