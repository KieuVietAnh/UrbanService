# Urban Service Mobile App - Service User Redesign Spec

Source of truth: `apps/web`. Mobile stack: Expo Router, React Native, NativeWind, React Query, Zustand, Geist.

This scope is only for the Service User role. Do not expose or implement System Staff, Interaction Manager, System Admin, or Service Provider workflows in the resident app.

## Source Rules To Preserve

Service User permissions come from `apps/web/src/roles/service-user/permissions.js`:

- `ticket:create`
- `ticket:view-own`
- `ticket:chat`
- `ticket:rate`
- `community:feed`
- `community:map`
- `ai:chat`

Primary Service User web routes come from `apps/web/src/routes/AppRoutes.jsx`:

- `/login`
- `/register`
- `/verify-email`
- `/`
- `/tickets`
- `/tickets/create`
- `/tickets/:id`
- `/community/feed`
- `/notifications`
- `/profile`

Mobile should use the same shared API layer wherever possible:

- Auth: `packages/shared-api/src/authApi.js`
- Feedback/tickets: `packages/shared-api/src/ticketApi.js`
- Feed: `apps/web/src/services/api/feedApi.js`
- Notifications: `packages/shared-api/src/notificationApi.js`
- Profile: `packages/shared-api/src/userApi.js`

## Ticket Status Source

Reuse `managementTypes.feedbackStatus` from the web/shared packages. Do not create new statuses for mobile.

Supported Service User statuses:

- `Submitted`
- `Assigned`
- `In Progress`
- `Resolved`
- `Closed`
- `Need Rework`
- `Rejected`

Status colors must reuse the shared semantic mapping from web, especially `packages/shared-types/src/statusSemantics.js`, `packages/shared-types/src/ticketConstants.js`, and the web badge semantics in `apps/web/src/components/design-system/badgeSemantics.js`. Mobile `TicketStatusBadge` must map API values through `managementTypes.feedbackStatus`.

## Mobile Information Architecture

Use bottom tabs for resident core:

- Home: dashboard and public/resident community summary
- Tickets: own feedback list
- Create: centered FAB or prominent create tab
- Community: public feed and map entry
- Profile: account, settings, logout

Use stack routes for:

- Auth: onboarding, login, register, OTP
- Ticket detail: `/tickets/[id]`
- Ticket review: `/tickets/[id]/review`
- Notifications: from dashboard bell and profile quick link

Guarding rule: after login/register, if `user.isVerified` is false, route to OTP. If role is not Service User, reject mobile resident entry and show a role-not-supported state rather than routing to staff/admin screens.

## Mobile Architecture

Target app structure:

```text
app/
|-- (auth)
|-- (resident)
|   |-- home
|   |-- tickets
|   |-- community
|   |-- profile
|   `-- create-ticket
|-- components
|-- services
|-- stores
|-- hooks
|-- constants
`-- theme
```

Architecture choices:

- State: Zustand
- Server state: React Query
- Navigation: Expo Router
- Styling: NativeWind
- Typography: Geist

Do not add mobile-only business endpoints, duplicate validation libraries, or resident-specific status models. Mobile should wrap and adapt the existing web/shared API contracts for native interaction patterns.

## Design System Direction

Reuse the web visual hierarchy, but translate it into native patterns:

- Web card heroes become compact native top summaries with large Geist headings and soft status chips.
- Web filter dropdowns become horizontal chips plus bottom sheets for advanced filtering.
- Web modal dialogs become native sheets or full-screen flows.
- Web map picker becomes a full-screen map selection step with a pinned confirmation bar.
- Web loading skeletons become shape-matched `AppSkeleton` blocks.
- Web empty/error states become `AppEmptyState` and `AppErrorState` with a single clear action.

Keep touch targets at least 44x44, use safe-area padding, support pull-to-refresh on list/dashboard/feed screens, and use haptic feedback only on meaningful submissions, tab switches, and confirmation actions.

## Screen Specs

### 1. Login

Web source screen: `apps/web/src/pages/auth/LoginPage.jsx`

Mobile redesign:

- Full-screen auth surface with UrbanMind brand, email/password inputs, password visibility toggle, primary login button, Google login option if mobile OAuth is configured.
- Preserve redirect intent behavior from web: after login, use the requested redirect when safe; otherwise route Service User to resident home.
- Show session-expired and login-intent notices as inline banners.

Components:

- `AuthScreenShell`
- `BrandLogo`
- `AppInput`
- `PasswordInput`
- `AppButton`
- `InlineAlert`
- `SocialLoginButton`

Navigation flow:

- Login success with `isVerified=true` and Service User role -> `/(resident)`
- Login success with `isVerified=false` -> `/(auth)/otp`
- Register link -> `/(auth)/register`

API integration mapping:

- `authApi.login(email, password)` -> `POST /api/auth/login`
- Optional Google: `authApi.googleLogin(idToken)` -> `POST /api/auth/google-login`
- Persist token, refresh token, and normalized Service User in mobile storage.

UX improvements over web:

- Use keyboard-aware layout and native autofill.
- Convert redirect/session messages into compact native banners.
- Disable login while request is in flight; keep errors inline rather than toast-only.

Required alignment gap:

- Current mobile validation accepts 6-character passwords; web requires at least 8 on registration and only requires non-empty on login. Align mobile to web behavior.

### 2. Register

Web source screen: `apps/web/src/pages/auth/RegisterPage.jsx`

Mobile redesign:

- Single-column form: full name, email, phone, password, confirm password.
- Keep registration draft in AsyncStorage for full name, email, and phone, matching web session draft behavior.
- Show duplicate email/phone and server validation as field-level errors.
- If editing pending registration from OTP, reuse the same screen in edit mode.

Components:

- `AuthScreenShell`
- `AppInput`
- `PasswordInput`
- `InlineFieldError`
- `AppButton`
- `StepHint`

Navigation flow:

- Submit valid registration -> save session -> send OTP -> `/(auth)/otp`
- Login link -> `/(auth)/login`
- Edit mode save -> back to `/(auth)/otp`

API integration mapping:

- `authApi.register(fullName, email, password, phone)` -> `POST /api/auth/register`
- `authApi.sendOtp()` -> `POST /api/auth/email-verification/send-otp`

Validation rules from web:

- `fullName.trim()` required and length >= 2
- Email required and must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Phone required and must match `/^0\d{9}$/`
- Password required unless editing and leaving password blank
- Password length >= 8
- Confirm password required when password is required
- Passwords must match

UX improvements over web:

- Use numeric keyboard and max length 10 for phone.
- Keep user on first invalid field with scroll/focus.
- Add strength guidance without inventing backend rules.

Required alignment gap:

- Current mobile OTP flow passes `phone`; web verification is email based and `sendOtp()` has no phone argument. Update mobile copy, params, and service calls to email verification.

### 3. OTP

Web source screen: `apps/web/src/pages/auth/VerifyEmailPage.jsx`

Mobile redesign:

- Six-digit OTP input with one-time-code autofill.
- Display destination email, not phone.
- Show 3-step progress: account created, email verification, complete.
- Allow edit registration details before verification.

Components:

- `OTPInput`
- `CountdownResend`
- `InlineAlert`
- `AppStepBar`
- `AuthScreenShell`

Navigation flow:

- Verify success -> Service User home
- Send/resend -> stay on OTP with 60-second cooldown
- Edit email/info -> `/(auth)/register?mode=edit`
- Switch account/logout -> login

API integration mapping:

- `authApi.sendOtp()` -> `POST /api/auth/email-verification/send-otp`
- `authApi.verifyOtp(otp)` -> `POST /api/auth/email-verification/verify`

Validation/state rules from web:

- OTP length: 6 digits
- Resend cooldown: 60 seconds
- OTP validity copy: 5 minutes
- Expired/used OTP errors should allow resend immediately
- Clear draft after successful verification

UX improvements over web:

- Native paste/autofill handling.
- Keep resend action visible under the input.
- Add haptic feedback for successful verification and invalid code.

### 4. Dashboard

Web source screen: `apps/web/src/pages/dashboard/Dashboard.jsx`; Service User dashboard config: `apps/web/src/roles/service-user/dashboardConfig.js`

Dashboard data sources:

- Reuse the same dashboard APIs currently used by `apps/web/src/pages/dashboard/Dashboard.jsx`, which is the actual dashboard source in this repo.
- If a future role-specific file such as `apps/web/src/pages/service-user/Dashboard.jsx` is introduced, treat it as the Service User dashboard source of truth.
- Do not create mobile-specific dashboard endpoints.
- Dashboard must display open tickets, in-progress tickets, resolved tickets, recent activities, and community summary using the same API contracts as web.

Dashboard API Mapping:

- Reuse the same APIs currently used by `apps/web/src/pages/dashboard/Dashboard.jsx`.
- Do not create mobile-specific dashboard endpoints.
- Dashboard data must be derived from existing web contracts.
- Open, in-progress, and resolved ticket counts must be computed from existing ticket/status data returned by the web/shared API layer.
- Recent activities must come from the same ticket/activity sources used by web, not from mobile-only mock data.
- Community summary must come from the same community feed contract used by web.

Mobile redesign:

- Resident home with greeting, create feedback CTA, ticket summary, recent activity, community preview, and notification entry.
- Replace broad web hero with a tighter native "today" summary and quick-action grid.
- Remove hardcoded impact metrics unless backed by web API data.

Components:

- `ResidentHomeHeader`
- `MetricChip`
- `QuickActionTile`
- `TicketCardCompact`
- `CommunityPreviewCard`
- `NotificationBellButton`
- `AppSkeleton`

Navigation flow:

- Create CTA -> `/(resident)/create-feedback`
- Ticket summary or recent item -> `/(resident)/tickets` or `/(resident)/tickets/[id]`
- Community preview -> `/(resident)/community`
- Bell -> `/(resident)/notifications`

API integration mapping:

- Recent own feedbacks: `ticketApi.getTickets({ pageNumber, pageSize }, { role: 'service-user' })` -> `GET /api/user/feedbacks`
- Community preview: `getCommunityFeed({ PageNumber: 1, PageSize: 3 })` -> `GET /api/user/feedbacks/feed`
- Notifications count: `notificationApi.getNotifications(1, 10, false)` -> `GET /api/notifications?isRead=false`
- Open/in-progress/resolved ticket counts should be derived from the same ticket list/status contracts used by web, not from hardcoded mobile counters.

Workflow states:

- Snapshot/cached content may show while refreshing, following web dashboard snapshot behavior.
- Pull-to-refresh reloads tickets, community preview, and notifications.

UX improvements over web:

- Place primary action within thumb reach.
- Use progressive disclosure for dashboard widgets; avoid desktop-like dense panels.
- Show empty state with "Create first feedback" when no tickets exist.

### 5. Ticket List

Web source screen: `apps/web/src/pages/tickets/TicketListPage.jsx`

Mobile redesign:

- List of own feedbacks with search, status chips, sort sheet, category sheet, and pull-to-refresh.
- Summary chips should mirror web groupings: all, processing, checking result, awaiting review, ended.
- Use infinite scroll or paginated "load more" instead of desktop pagination controls.

Components:

- `TicketListHeader`
- `SearchInput`
- `StatusFilterChips`
- `FilterBottomSheet`
- `TicketCard`
- `TicketStatusBadge`
- `AppEmptyState`

Navigation flow:

- Ticket card -> `/(resident)/tickets/[id]`
- Empty CTA -> create ticket
- Filter chip -> update query and refetch

API integration mapping:

- `ticketApi.getTickets(filters, { role: 'service-user' })` -> `GET /api/user/feedbacks`
- Categories for filter: `toolsApi.getCategories()`

Status grouping from web:

- Processing: `SUBMITTED`, `AI_REVIEWED`, `VERIFIED`, `ASSIGNED`, `IN_PROGRESS`, `NEED_REWORK`
- Checking result: `RESOLVED`, `SUBMITTED_FOR_APPROVAL`
- Results: `RESOLVED`, `SUBMITTED_FOR_APPROVAL`, `APPROVED`, `CLOSED`
- Awaiting review: `APPROVED`
- Ended: `CLOSED`
- Also support `REJECTED` and `CANCELLED`

UX improvements over web:

- Preserve return context by highlighting the last opened ticket after back navigation.
- Use sticky search/filter area only if it does not reduce list readability.
- Use native bottom sheets for category/sort instead of small dropdown menus.

Required alignment gap:

- Current mobile status constants use `PENDING`, `PROCESSING`, `AWAITING_REVIEW`. Replace with or map from `managementTypes.feedbackStatus` so labels match web canonical statuses.

### 6. Ticket Detail

Web source screen: `apps/web/src/pages/tickets/TicketDetailPage.jsx`; hook: `apps/web/src/hooks/useTicketDetail.js`

Mobile redesign:

- Detail stack with top status summary, location card/map, description, attachments carousel, timeline, comments/chat, duplicate/related feedback notice, and resolution review CTA when eligible.
- Use segmented sections or collapsible panels: Overview, Timeline, Discussion, Evidence.
- Media preview should open full-screen with swipe navigation.

Components:

- `TicketDetailHeader`
- `TicketStatusBadge`
- `TicketTimeline`
- `TicketAttachmentGrid`
- `LocationSummaryCard`
- `CommentThread`
- `MessageComposer`
- `ResolutionReviewPanel`
- `ActionSheet`

Navigation flow:

- Back -> return path from ticket list/community notification context
- Review CTA -> `/(resident)/tickets/[id]/review`
- Edit allowed ticket -> edit sheet/full-screen edit flow
- Delete allowed ticket -> confirmation modal

API integration mapping:

- Detail: `ticketApi.getTicketById(feedbackId, { role: 'service-user' })` -> `GET /api/user/feedbacks/{feedbackId}`
- History: `ticketApi.getHistory(feedbackId, { role: 'service-user' })`
- Comments: `ticketApi.getComments(feedbackId, { role: 'service-user' })`
- Add comment: `ticketApi.addComment(feedbackId, null, null, null, content, { role: 'service-user' })`
- Review: `ticketApi.submitReview(feedbackId, null, rating, isSatisfied, comment, { role: 'service-user' })`
- Edit: `ticketApi.updateTicket(feedbackId, data, { role: 'service-user' })`
- Delete: `ticketApi.deleteTicket(feedbackId, { role: 'service-user' })`
- Attachment add/delete: `ticketApi.addAttachments`, `ticketApi.deleteAttachment`

Validation/rules from web:

- Comment content must be trimmed before send.
- Edit attachment max count: 5
- Edit image max size: 5 MB
- Edit video max size: 10 MB
- Rating is submitted only in the resolution review state.

UX improvements over web:

- Timeline becomes a native vertical progress rail.
- Put comment composer above keyboard with safe-area inset.
- Move destructive actions into an action sheet, not always-visible buttons.

### 7. Create Ticket

Web source screen: `apps/web/src/pages/tickets/CreateTicketPage.jsx`

Create Ticket source:

- Reuse all business logic from `apps/web/src/pages/tickets/CreateTicketPage.jsx`, which is the actual Service User create-ticket source in this repo.
- If a future role-specific file such as `apps/web/src/pages/service-user/CreateTicketPage.jsx` is introduced, treat it as the Service User create-ticket source of truth.
- Required validations must be identical to web.
- AI duplicate detection and AI category suggestion must reuse existing APIs and web contracts.

Mobile redesign:

- Five-step native creation wizard:
  1. Category
  2. Description
  3. Location
  4. Evidence
  5. Review
- Use a full-screen map selection step with a bottom confirmation bar.
- Persist draft per user in AsyncStorage, excluding binary attachments, matching web behavior.

Components:

- `CreateFeedbackWizard`
- `AppStepBar`
- `CategoryPickerSheet`
- `PrioritySelector`
- `AreaPickerSheet`
- `MapLocationPicker`
- `EvidencePicker`
- `AttachmentPreview`
- `LeaveDraftDialog`

Navigation flow:

- Dashboard FAB/tab -> create flow
- Step next validates the current step using the same required fields and limits as web
- Submit success -> ticket detail or tickets list with success state
- Back with draft -> leave confirmation

API integration mapping:

- Areas: `toolsApi.getAreas()`
- Categories: `toolsApi.getCategories()`
- AI category suggestion and duplicate detection: reuse the existing web APIs/contracts only; do not invent mobile-only AI checks.
- Submit: `ticketApi.createTicket(null, null, payload, { role: 'service-user' })` -> `POST /api/user/feedbacks` multipart fields:
  - `AreaId`
  - `CategoryId`
  - `Title`
  - `Description`
  - `LocationText`
  - `Latitude`
  - `Longitude`
  - `LocationAccuracyMeters`
  - `GeoSource`
  - `Priority`
  - `DueDate`
  - `Attachments`

Validation rules from web:

- Category step: category required; priority must use existing web priority values.
- Description step: title required, description required.
- Location step: area required, latitude and longitude required.
- Evidence step: at least one attachment required.
- Review step: must not submit until all previous step validations pass.
- Max attachments: 5
- Image max size: 5 MB
- Video max size: 10 MB
- Total attachment size max: 20 MB
- Default priority: `Medium`
- Priority values: `Low`, `Medium`, `High`, `Urgent`

UX improvements over web:

- Camera-first evidence capture with library fallback.
- Inline file-size errors before upload.
- Clear step labels and disabled submit until required evidence exists.
- Keep draft restore banner short and actionable.

### 8. Community Feed

Web source screens:

- `apps/web/src/pages/community/CommunityFeedPage.jsx`
- `apps/web/src/pages/community/CommunityFeedbackDetailPage.jsx`
- `apps/web/src/pages/community/CommunityMapPage.jsx`
- API helper: `apps/web/src/services/api/feedApi.js`

Community Feed scope:

Allowed:

- Browse feed
- View details
- View map
- Support existing feedback
- Comment if supported by current APIs

Not allowed:

- Moderator actions
- Staff actions
- Approval actions

Community Feed API Mapping:

- Reuse the same APIs used by `apps/web/src/pages/community/CommunityFeedPage.jsx`.
- Browse feed through the existing community feed contract.
- View detail through the existing community feed detail contract.
- View map through the existing community map/feed data contract.
- Support feedback only through the existing Service User-supported API.
- View comments only through the existing comment/feed detail API support.
- Do not create moderation features.

Mobile redesign:

- Public/resident feed of community feedbacks with tabs/chips for latest/trending/nearby where supported by the web API.
- Feed cards show status, area, category, title, short description, support/comment counts if present, and first media preview.
- Auth-required actions such as commenting/supporting should prompt login only when the user is unauthenticated.

Components:

- `CommunityFeedHeader`
- `CommunityFeedCard`
- `MediaPreview`
- `SupportButton`
- `CommentDrawer`
- `FeedFilterSheet`

Navigation flow:

- Feed card -> community detail
- Support -> optimistic update with rollback
- Comment -> bottom sheet/detail discussion
- Map entry -> community map if included in mobile phase

API integration mapping:

- Feed: `GET /api/user/feedbacks/feed` with normalized params:
  - `PageNumber`
  - `PageSize`
  - `Status`
  - `CategoryId`
  - `Search`
- Detail: `GET /api/user/feedbacks/feed/{feedbackId}`
- Support/comment use ticket APIs only where web already allows Service User interaction.

UX improvements over web:

- Infinite feed with pull-to-refresh.
- Media-first cards sized for scanning on mobile.
- Comments open in a sheet to preserve feed context.

### 9. Notifications

Web source screen: `apps/web/src/pages/notifications/NotificationCenterPage.jsx`; API: `packages/shared-api/src/notificationApi.js`

Notification flow:

- Notifications must reuse `packages/shared-api/src/notificationApi.js`.
- Features: list notifications, mark as read, navigate to related ticket, pull to refresh.
- Do not implement admin/staff notifications.

Mobile redesign:

- Notification inbox grouped by read/unread and date.
- Include mark-all-read action in header overflow or secondary button.
- Tapping notification marks it read and routes to related screen when possible.

Components:

- `NotificationList`
- `NotificationRow`
- `UnreadDot`
- `DateGroupHeader`
- `AppEmptyState`

Navigation flow:

- Dashboard bell -> notifications
- Notification related to feedback -> ticket detail or community detail depending `relatedType`
- Back -> previous screen

API integration mapping:

- `notificationApi.getNotifications(pageNumber, pageSize, isRead)` -> `GET /api/notifications`
- `notificationApi.markNotificationAsRead(notificationId)` -> `PATCH /api/notifications/{notificationId}/read`
- `notificationApi.markAllNotificationsAsRead()` -> `PATCH /api/notifications/read-all`
- Related ticket navigation must route to the resident ticket detail screen and must not open staff/admin destinations.

UX improvements over web:

- Swipe actions for mark read/unread where feasible.
- Optimistic read state on tap.
- Badge count cached for dashboard bell.

### 10. Profile

Web source screen: `apps/web/src/pages/profile/ProfilePage.jsx`; API: `packages/shared-api/src/userApi.js`

Profile scope:

Allowed:

- View profile
- Update profile
- Change avatar if supported by the current web/API contract
- Logout

Not allowed:

- Role management
- User administration

Mobile redesign:

- Profile overview with name, email, phone, verification status, role label, quick links, edit profile, settings, logout.
- Service User only: no role management, admin status, or staff modules.
- Settings can include theme and notification preferences only if backed by existing web behavior.

Components:

- `ProfileHeader`
- `ProfileInfoCard`
- `VerifiedBadge`
- `ProfileActionRow`
- `EditProfileSheet`
- `LogoutDialog`

Navigation flow:

- Profile tab -> profile
- Edit -> profile edit sheet/full-screen form
- Notifications row -> notifications
- Logout -> login

API integration mapping:

- `userApi.getProfile(userId)` -> `GET /api/user/profile/{userId}`
- `userApi.updateProfile(userId, data)` -> `PUT /api/user/profile/{userId}`
- `authApi.logout()` clears local session; backend logout is a resolved no-op in shared API.

UX improvements over web:

- Keep identity and verification state visible.
- Use a single edit surface with immediate field validation.
- Confirm logout with native modal and clear stored auth state.

## Shared Components To Build Or Normalize

- `AppScreen`: safe area, background, keyboard avoidance options
- `AppHeader`: title, back action, trailing icon/action
- `AppInput`, `AppTextArea`, `PasswordInput`
- `AppButton`
- `AppBadge`
- `TicketStatusBadge`: backed by `managementTypes.feedbackStatus`
- `TicketCard`
- `TicketTimeline`
- `TicketAttachmentGrid`
- `AppSkeleton`
- `AppEmptyState`
- `AppErrorState`
- `BottomSheet`
- `ActionSheet`
- `Toast`
- `OTPInput`
- `MapLocationPicker`

## API Alignment Checklist

- Replace mobile auth OTP phone params with email verification calls from shared auth API.
- Normalize mobile role handling to reject non-Service User roles rather than mapping `system*` into mobile.
- Replace mobile status constants with canonical shared `managementTypes.feedbackStatus` values.
- Ensure all resident feedback calls pass `{ role: 'service-user' }` so base path stays `/api/user/feedbacks`.
- Use shared notification and user API wrappers; avoid inventing mobile-only endpoints.
- Review `apps/mobile/src/services/api/messageApi.ts`: it currently points to `/api/feedbacks/{id}/messages`, while web comments use `/api/user/feedbacks/{id}/comments`. Prefer the web comment path unless backend Swagger confirms messages are separate for Service User.

## Implementation Order

1. Auth alignment: login, register, email OTP, Service User guard.
2. Shared status and API normalization.
3. Ticket list/detail with canonical statuses and comments/review.
4. Create ticket wizard with draft, location, and attachment validation.
5. Dashboard summaries and notification badge.
6. Community feed and profile polish.

## Acceptance Criteria

- Every mobile screen maps to a web source screen and shared API method.
- No staff/admin/manager routes are reachable from mobile resident navigation.
- Register and OTP behavior matches web email verification exactly.
- Ticket create validation matches web limits for title, description, area, location, attachments, and priority.
- Ticket list uses web status groupings.
- Ticket detail supports history, comments, attachments, and resolution review when allowed by status.
- All loading, empty, error, and offline states are represented with reusable components.
