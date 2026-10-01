# Production Readiness Report

## Scope and baseline

- Scope: `apps/mobile`
- Review date: 2026-08-15
- Baseline commit: `d5c595e`
- Baseline ESLint: 0 errors, 157 warnings
- Large modules reviewed:
  - `create-feedback-wizard-screen.tsx`: 1,249 lines
  - `inbox-hub-screen.tsx`: 1,531 lines
  - `community-map.native.tsx`: 989 lines
  - `ticket-detail-screen.tsx`: 1,304 lines

This phase used static source inspection, query/data-flow tracing, permission/API contract review, secret-pattern searches, and production build validation. It did not include native profiling, penetration testing, device memory measurement, or backend load testing.

## Performance findings

### Changes applied

| Area | Finding | Change | Expected impact |
| --- | --- | --- | --- |
| App startup | Nine Geist font weights were loaded, but only Regular, Medium, SemiBold, and Bold have active consumers | Removed five unused registrations and switched the four active weights to direct package entrypoints | Web export fell from 37 to 23 assets and from 1,560 to 1,548 modules without visual changes |
| Ticket detail | Detail and comments queries both called the same `GET /api/user/feedbacks/{id}` endpoint on initial render | Reused `ticket.comments` from one polled detail query | Removes one duplicate initial request and one query/cache path |
| Ticket comments | Fallback comment keys used `Math.random()` | Replaced with a deterministic index fallback | Prevents needless row remounts when an ID is absent |
| Community map | `onEndReached` could call `fetchNextPage` while another page was still loading | Added an `isFetchingNextPage` guard | Prevents overlapping/cancel-restart pagination calls |
| Inbox support | Messages were sorted and then scanned again with `reduce` to find the latest message | Reused the final sorted message | Removes one redundant pass per support thread |
| Production logging | Multiple mobile screens emitted diagnostic logs and raw error objects | Removed routine logs or restricted sanitized diagnostics to `__DEV__` | Avoids production logging overhead and reduces accidental data disclosure |

### Module-specific observations

#### Create feedback wizard

- Attachment rendering is bounded to five files, so its mapped previews do not justify a FlatList conversion.
- Category/area lookups and attachment-size totals are already memoized around stable source arrays.
- Draft persistence currently writes to AsyncStorage on every relevant state change, including title and description keystrokes. This is a measurable write-amplification risk, but debouncing was not introduced because it changes crash/rapid-exit durability semantics.
- Full-resolution local image/video URIs are used for previews. File count and upload-size limits reduce the ceiling, but native memory should still be measured with maximum-size attachments.
- The module remains too large for comfortable maintenance, but splitting it was intentionally excluded because it would be structural refactoring rather than a focused optimization.

#### Inbox hub

- AI conversations load independently; support threads are fetched only after the support tab is selected.
- Support discovery remains an N+1 workflow: up to 15 feedbacks, up to 15 message probes, and detail requests for threads with messages. Query caching limits repeated work, but the initial support-tab load can still produce up to 31 requests.
- Fixing the N+1 pattern safely requires a backend conversation-summary endpoint or a contract that includes last message, unread count, and thumbnail data.
- Both FlatLists have stable item keys and bounded row components. Inline row press closures were retained because the rows are not memoized and adding memoization without profiling would add complexity without demonstrated benefit.
- Remote thumbnails use React Native `Image` without explicit thumbnail sizing/caching policy. A server thumbnail contract or measured migration to `expo-image` is future work.

#### Community native map

- Feed pages are flattened and marker data is memoized.
- Marker count grows as additional feed pages are loaded. Clustering helps presentation, but all custom marker React elements are still constructed from the loaded dataset.
- `tracksViewChanges` was not disabled because custom marker behavior can differ across Android devices and requires visual regression testing.
- Area selection uses a ScrollView. This is acceptable for the current small reference dataset; it should become a virtualized list only if area counts grow substantially.

#### Ticket detail

- The backend detail DTO already contains comments, so a separate comments query was duplicate HTTP work.
- The consolidated detail query keeps the existing six-second refresh cadence, preserving comment freshness while also refreshing ticket status and attachments.
- Attachment galleries and timeline rows are bounded detail content; replacing them with nested virtualized lists would add complexity without clear benefit.
- Remote full-size attachments can still create memory pressure in the zoom modal. Thumbnail/full-image separation should be designed with backend support.

### Performance work intentionally deferred

1. Profile JavaScript/UI frame time and native memory on a physical mid-range Android device.
2. Replace Inbox support probing with a backend summary endpoint.
3. Define thumbnail variants for Inbox, ticket galleries, and map/detail previews.
4. Decide and test a debounced draft persistence policy that flushes on navigation/background transitions.
5. Split the four large modules by stable UI/data responsibilities only after runtime coverage exists.

## Security findings

### High-risk findings requiring follow-up

#### Authentication tokens use AsyncStorage

`urbanmind_auth_token` and `urbanmind_refresh_token` are stored through AsyncStorage. The persisted Zustand user object also historically contained the access token.

Changes in this phase:

- Future Zustand persistence writes strip `user.token` to avoid duplicating the token in `urbanmind-auth`.
- Android Auto Backup is disabled so AsyncStorage session and report-draft data are not copied through device backup.

Remaining risk:

- The canonical access and refresh token entries are still unencrypted at rest.
- Existing persisted `urbanmind-auth` records may retain a token until the state is rewritten or explicitly migrated.
- A future atomic migration should introduce `expo-secure-store`, migrate existing tokens once, handle web separately, verify refresh-token rotation, and remove legacy AsyncStorage token copies only after successful secure persistence.

Expo documents AsyncStorage as unencrypted and recommends SecureStore for small secrets such as tokens. SecureStore uses Android Keystore-backed encryption and iOS Keychain storage.

#### Shared API logs sensitive request and response data

`packages/shared-api/src/axiosClient.js` is outside this phase's write scope, but it is bundled into the mobile application and currently logs:

- request bodies and parameters;
- refresh-token and Google ID-token request bodies because only `password` is redacted;
- successful response bodies, including authentication responses that can contain access and refresh tokens;
- error response bodies, request data, and stack traces.

Mobile-local logs were removed or restricted to `__DEV__`, but that does not neutralize shared-api logging. Production release should be blocked until shared logging is disabled in production and all authentication fields are redacted in development diagnostics.

### Authentication and session handling

- Requests use HTTPS and attach `Authorization: Bearer <token>` through the shared Axios interceptor.
- Refresh is single-flight through a shared promise, reducing parallel refresh races.
- A mobile unauthorized handler is now registered. Terminal refresh failures clear React Query caches and the persisted Zustand user, returning the app to the unauthenticated route rather than leaving a stale authenticated UI.
- Explicit logout already clears query cache and auth tokens.
- Storage service failures are swallowed. Secure-token migration should surface storage failures rather than silently continuing with an inconsistent session.

### API and environment configuration

- Effective API URL comes from `EXPO_PUBLIC_API_URL`, Expo `extra`, or an HTTPS production fallback.
- The API URL and Google OAuth client ID are public client configuration, not secrets.
- `.env` is not tracked and contains only public Expo variables.
- Static secret-pattern scanning found no private key, common access-token prefix, or client-secret value under `apps/mobile`.
- One generic Google OAuth client ID is configured while platform-specific iOS, Android, and web IDs are absent. This is a deployment/configuration risk, not secret exposure; native standalone Google login should be validated with release credentials.
- No standalone Android Google Maps API key is present in app config. Expo Go map success does not prove a release build is configured; verify the EAS/native credential path before release.

### Local report drafts

The reporting wizard stores title, description, selected area, free-form location text, and coordinates in AsyncStorage. This intentionally enables draft recovery but leaves potentially sensitive civic-report data unencrypted. A future privacy decision should define retention duration, logout behavior, and whether the draft belongs in encrypted storage.

## Android permissions review

| Permission | Classification | Evidence and decision |
| --- | --- | --- |
| `INTERNET` | Required | Needed for API, media, authentication, and map networking |
| `ACCESS_COARSE_LOCATION` | Required | Used by foreground location flows and map positioning |
| `ACCESS_FINE_LOCATION` | Required | Required for precise incident/report coordinates; current flows request precise location |
| `CAMERA` | Required | Reporting wizard calls `launchCameraAsync` |
| `LOCATION_HARDWARE` | Removed | Android documents it as not for third-party applications; the app uses standard foreground location APIs |
| `READ_EXTERNAL_STORAGE` | Possibly obsolete/deprecated | Android 13 replaces it with granular media permissions and recommends the system photo picker; Expo ImagePicker still declares compatibility permissions. Retained pending minimum-OS and standalone media regression tests |
| `WRITE_EXTERNAL_STORAGE` | Unsafe/deprecated legacy permission | Has no effect for apps targeting Android 11+, but may be merged by ImagePicker compatibility manifests. Retained until old-Android support and final merged manifest are tested; then block explicitly with `android.blockedPermissions` if safe |
| `RECORD_AUDIO` (library-merged) | Conditionally required | Expo ImagePicker may add it for video capture. The wizard permits video, so it was not blocked without a product decision on audio recording |

Only `LOCATION_HARDWARE` was removed with high confidence. Storage permissions were not removed merely because they are deprecated; the final merged release manifest and supported Android versions must be verified first.

## Remaining production risks

### Release blockers

1. Shared API production logging can disclose access tokens, refresh tokens, Google ID tokens, request data, and response payloads.
2. Access and refresh tokens remain in unencrypted AsyncStorage.

### High priority

1. Native release-build authentication and Google OAuth credentials are not validated.
2. Native release-build Google Maps credentials are not validated.
3. Support Inbox N+1 request fan-out can stress both client and backend.
4. Physical-device memory/performance tests with maximum attachments and large map datasets are missing.

### Medium priority

1. Report drafts contain location and description data without a retention/encryption policy.
2. Legacy Android storage permissions need a merged-manifest and old-Android compatibility decision.
3. Four feature screens remain very large and expensive to maintain.
4. React Query has no native online/focus manager integration, so background/online refresh behavior remains dependent on screen-specific handling.

## Recommended future work

1. In `packages/shared-api`, make diagnostics development-only and redact `password`, access tokens, refresh tokens, ID tokens, authorization headers, cookies, and response auth payloads.
2. Add `expo-secure-store` and ship an atomic, backward-compatible token migration with native release tests.
3. Inspect the final EAS Android manifest and block obsolete storage permissions only after image/video picker tests across supported API levels.
4. Validate Google OAuth and Maps credentials in signed Android/iOS release candidates.
5. Add backend support-conversation summaries to eliminate Inbox request fan-out.
6. Profile cold start, Inbox support load, map marker load, ticket polling, and maximum attachment previews on physical devices.

## Validation results

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit --pretty false` | PASS |
| `pnpm run lint` | PASS with 0 errors and 157 warnings (baseline unchanged) |
| `pnpm exec expo export --platform web` | PASS |
| Expo Router web bundle | PASS, 1,548 modules |
| Exported assets | 23, reduced from the prior 37-asset baseline |
| Main web entry | 2.78 MB (prior export: 2.79 MB) |
| Secret-pattern scan under `apps/mobile` | No private-key/client-secret/common secret-token pattern found |
| `git diff --check` | PASS |

The ignored `apps/mobile/dist` export output was removed after validation.

## References

- [Expo authentication guidance](https://docs.expo.dev/guides/authentication/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo permissions guide](https://docs.expo.dev/guides/permissions/)
- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Android 13 granular media permissions](https://developer.android.com/about/versions/13/behavior-changes-13#granular-media-permissions)
- [Android data and file storage](https://developer.android.com/training/data-storage)
- [Android `LOCATION_HARDWARE`](https://developer.android.com/reference/android/Manifest.permission#LOCATION_HARDWARE)
