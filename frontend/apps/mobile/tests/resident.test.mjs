import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const communityApi = read('../src/features/community/api/community-api.ts');
const communityFeedCard = read('../src/features/community/components/community-feed-card.tsx');
const communityMap = read('../src/features/community/components/community-map.native.tsx');
const communitySupportCache = read('../src/features/community/utils/support-cache.ts');
const residentLayout = read('../app/(resident)/_layout.tsx');
const ticketDetail = read('../src/features/reporting/components/ticket-detail-screen.tsx');
const wizard = read('../src/features/reporting/components/create-feedback-wizard-screen.tsx');
const addressGeocoding = read('../src/features/reporting/services/address-geocoding.ts');
const homeStyles = read('../src/features/home/homeStyles.ts');
const quickActions = read('../src/features/home/components/QuickActions.tsx');
const inbox = read('../src/features/messaging/components/inbox-hub-screen.tsx');
const notifications = read('../src/features/notifications/components/notifications-screen.tsx');
const areaAlertsApi = read('../src/features/area-alerts/api/area-alerts-api.ts');
const aiConversation = read('../src/features/messaging/components/ai-conversation-screen.tsx');
const residentStatus = read('../src/features/resident-status.ts');
const swagger = read('../../../swagger.json');
const appConfig = read('../app.json');
const dynamicAppConfig = read('../app.config.js');
const rootLayout = read('../app/_layout.tsx');
const brandSplash = read('../src/screens/splash/SplashScreen.tsx');

test('native and branded splash screens both use the bundled UrbanMind artwork', () => {
  assert.match(appConfig, /"expo-splash-screen"/);
  assert.match(appConfig, /"image": "\.\/assets\/icon\.png"/);
  assert.match(dynamicAppConfig, /'expo-splash-screen'/);
  assert.match(dynamicAppConfig, /image: '\.\/assets\/icon\.png'/);
  assert.match(rootLayout, /BrandSplashScreen/);
  assert.match(rootLayout, /BRAND_SPLASH_DURATION_MS/);
  assert.match(brandSplash, /require\('\.\.\/\.\.\/\.\.\/assets\/icon\.png'\)/);
});

test('community is Incident-centric while My Feedback remains Feedback-centric', () => {
  assert.match(communityApi, /\/api\/public\/incidents/);
  assert.doesNotMatch(communityApi, /\/api\/user\/feedbacks\/feed/);
  assert.match(ticketDetail, /feedbackApi\.getById/);
  assert.match(ticketDetail, /ticket\.incidentId/);
});

test('resident detail actions cannot be covered by the Android tab or system navigation bars', () => {
  assert.match(residentLayout, /marginBottom:\s*tabBarHeight/);
  assert.match(residentLayout, /RESIDENT_TAB_BAR_HEIGHT\s*\+\s*insets\.bottom/);
  assert.match(ticketDetail, /insets\.bottom\s*\+\s*8/);
});

test('feedback evidence is optional and GPS metadata is honest and recoverable', () => {
  assert.doesNotMatch(wizard, /AI sẽ tự động phân loại/);
  assert.doesNotMatch(wizard, /if\s*\(attachments\.length\s*===\s*0\)/);
  assert.match(wizard, /getLastKnownPositionAsync/);
  assert.match(wizard, /GPS_TIMEOUT_MS/);
  assert.match(wizard, /locationAccuracyMeters/);
  assert.match(wizard, /setGeoSource\('GPS'\)/);
  assert.match(wizard, /setGeoSource\('MANUAL'\)/);
  assert.match(wizard, /geoSource,/);
});

test('feedback address input searches real Vietnamese geocoding services and focuses the map', () => {
  assert.match(addressGeocoding, /geocode\.arcgis\.com/);
  assert.match(addressGeocoding, /photon\.komoot\.io/);
  assert.match(addressGeocoding, /countryCode:\s*'VNM'/);
  assert.match(wizard, /searchVietnameseAddresses/);
  assert.match(wizard, /setTimeout\(async \(\) =>/);
  assert.match(wizard, /style=\{styles\.mapSearchOverlay\}/);
  assert.match(wizard, /label="Tìm địa chỉ trên bản đồ"/);
  assert.match(wizard, /onAddressSelect\(suggestion\.displayName, suggestion\.latitude, suggestion\.longitude\)/);
  assert.match(wizard, /latitudeDelta:\s*0\.008/);
  assert.match(wizard, /addressSuggestions\.slice\(0, 4\)/);
  assert.match(wizard, /Text as NativeText/);
  assert.match(wizard, /addressSuggestionItem:\s*\{\s*width:\s*'100%'/);
  assert.match(wizard, /addressSuggestionCopy:\s*\{\s*flexGrow:\s*1,\s*flexShrink:\s*1,\s*flexBasis:\s*0/);
  assert.doesNotMatch(wizard, /contentContainerStyle=\{styles\.addressSuggestionListContent\}/);
});

test('community support reacts immediately and reconciles with the API in background', () => {
  assert.match(communityFeedCard, /onMutate:\s*async/);
  assert.match(communityFeedCard, /supportMutation\.mutate\(!isSupported\)/);
  assert.doesNotMatch(communityFeedCard, /loading=\{supportMutation\.isPending\}/);
  assert.match(communityMap, /applyOptimisticCommunitySupport/);
  assert.doesNotMatch(communityMap, /Đang gửi\.\.\./);
  assert.match(communitySupportCache, /pages:\s*infiniteData\.pages\.map/);
  assert.match(communitySupportCache, /restoreCommunityCache/);
});

test('resident home keeps the chat FAB without covering content with an oversized control', () => {
  const floatingChat = read('../src/components/ui/FloatingChatMenu.tsx');
  assert.match(residentLayout, /<FloatingChatMenu/);
  assert.match(residentLayout, /insets\.bottom\s*\+\s*68/);
  assert.match(floatingChat, /width:\s*58/);
  assert.match(floatingChat, /height:\s*58/);
  assert.match(quickActions, /useWindowDimensions/);
  assert.match(homeStyles, /actionItemPhone:\s*\{\s*width:\s*'28%'/);
  assert.doesNotMatch(homeStyles, /Dimensions\.get/);
  assert.doesNotMatch(homeStyles, /ACTION_WIDTH|ACTION_ROWS/);
});

test('cached inbox content stays visible during background refresh', () => {
  assert.match(inbox, /aiLoading\s*&&\s*aiData\s*===\s*undefined/);
  assert.match(inbox, /supportLoading\s*&&\s*supportThreads\s*===\s*undefined/);
  assert.match(inbox, /refreshing=\{aiRefetching\}/);
  assert.match(inbox, /refreshing=\{supportRefetching\}/);
});

test('notifications degrade to the correct list instead of leaving a dead View action', () => {
  assert.match(notifications, /community\/\$\{incidentId\}/);
  assert.match(notifications, /router\.push\('\/\(resident\)\/community'/);
  assert.match(notifications, /tickets\/\$\{targetId\}/);
  assert.match(notifications, /router\.push\('\/\(resident\)\/tickets'/);
});

test('Area Alerts and AI-assisted Feedback draft use real contracted paths', () => {
  assert.match(areaAlertsApi, /userAreaAlertApi\.getSubscriptions/);
  assert.match(areaAlertsApi, /userAreaAlertApi\.getAlerts/);
  assert.match(aiConversation, /createAiFeedbackDraft/);
  assert.match(aiConversation, /urbanmind:create-ticket-draft/);
  assert.match(aiConversation, /\/\(resident\)\/create-feedback/);
});

test('public status vocabulary does not expose internal rework or assignment mechanics', () => {
  assert.match(residentStatus, /Đã gửi/);
  assert.match(residentStatus, /Đã tiếp nhận/);
  assert.match(residentStatus, /Đang xử lý/);
  assert.match(residentStatus, /Đang kiểm tra kết quả/);
  assert.match(residentStatus, /Hoàn thành/);
  assert.doesNotMatch(residentStatus, /NeedRework|Provider|Phân công/);
});

test('phone OTP follows the live backend and native Firebase contracts', () => {
  const authService = read('../src/features/auth/auth.service.ts');
  const firebasePhone = read('../src/features/auth/firebase-phone.service.ts');
  const verifyPhoneScreen = read('../app/(auth)/verify-phone.tsx');
  assert.match(swagger, /\/api\/auth\/phone-verification\/request-otp/);
  assert.match(swagger, /\/api\/auth\/phone-verification\/verify/);
  assert.match(authService, /authApi\.requestPhoneOtp/);
  assert.match(authService, /authApi\.verifyPhone/);
  assert.match(firebasePhone, /signInWithPhoneNumber/);
  assert.match(firebasePhone, /getIdToken\(true\)/);
  assert.match(verifyPhoneScreen, /Xác thực số điện thoại/);
  assert.match(dynamicAppConfig, /'@react-native-firebase\/app'/);
  assert.match(dynamicAppConfig, /'@react-native-firebase\/auth'/);
});
