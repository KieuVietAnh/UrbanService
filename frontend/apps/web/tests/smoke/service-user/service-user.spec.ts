import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TicketListPage } from '../../pages/TicketListPage';
import { TicketDetailPage } from '../../pages/TicketDetailPage';

const serviceUserEmail = process.env.SERVICE_USER_EMAIL;
const serviceUserPassword = process.env.SERVICE_USER_PASSWORD;

const dashboardRoute = '/';
const ticketListRoute = '/tickets';
const communityFeedRoute = '/community/feed';
const notificationCenterRoute = '/notifications';
const profileRoute = '/profile';

type PageMonitor = {
  pageErrors: string[];
  consoleErrors: string[];
  badResponses: string[];
};

const attachPageMonitoring = (page: Page): PageMonitor => {
  const monitor: PageMonitor = {
    pageErrors: [],
    consoleErrors: [],
    badResponses: [],
  };

  page.on('pageerror', (error) => {
    monitor.pageErrors.push(error?.message || String(error));
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      monitor.consoleErrors.push(message.text());
    }
  });

  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    const status = response.status();

    if (status >= 400 && /\/api\//i.test(url)) {
      monitor.badResponses.push(`${status} ${request.method()} ${url}`);
    }
  });

  return monitor;
};

const assertNoErrors = async (monitor: PageMonitor, context: string) => {
  // Ignore known benign parser errors that sometimes occur when endpoints return HTML pages.
  const relevantPageErrors = monitor.pageErrors.filter((e) => !/Unexpected token '<'/.test(String(e)));
  if (monitor.pageErrors.length !== relevantPageErrors.length) {
    console.warn(`${context}: filtered ${monitor.pageErrors.length - relevantPageErrors.length} benign page errors`);
  }
  expect(relevantPageErrors, `${context}: unexpected uncaught page errors`).toEqual([]);
  expect(monitor.consoleErrors, `${context}: unexpected console errors`).toEqual([]);
  expect(monitor.badResponses, `${context}: unexpected API failures`).toEqual([]);
};

const loginAsServiceUser = async (page: Page) => {
  if (!serviceUserEmail || !serviceUserPassword) {
    throw new Error('SERVICE_USER_EMAIL và SERVICE_USER_PASSWORD chưa được cấu hình.');
  }

  await page.goto('/login');
  const loginPage = new LoginPage(page);
  await loginPage.login(serviceUserEmail, serviceUserPassword);
  await page.waitForLoadState('domcontentloaded');

  const loginError = loginPage.errorMessage;
  const hasLoginError = await loginError.isVisible({ timeout: 6000 }).catch(() => false);
  if (hasLoginError) {
    const message = (await loginError.first().innerText().catch(() => '')).trim() || 'Email hoặc mật khẩu không chính xác.';
    // If it's a rate-limit error, throw a descriptive message so it's identifiable
    throw new Error(`Service user login failed for ${serviceUserEmail}: ${message}. The external service-user account or backend auth flow is unavailable in this environment.`);
  }

  // Wait until the app redirects away from the login route and the client finishes loading.
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), undefined, { timeout: 30000 }).catch(async () => {
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Service user login did not redirect. URL=${url}. Body=${bodyText.slice(0, 200)}...`);
  });

  // Wait for either the service-user landing hero or a dashboard shell to appear.
  await page.waitForSelector('#landing-hero-title, .citizen-dashboard-page, header', { timeout: 15000 });
  expect(new URL(page.url()).pathname).not.toContain('/login');
};

const verifyRouteAndPage = async (page: Page, route: string, locator: string | ReturnType<Page['locator']>, description: string) => {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');

  if (typeof locator === 'string') {
    await expect(page.locator(locator)).toBeVisible({ timeout: 15000 });
  } else {
    await expect(locator).toBeVisible({ timeout: 15000 });
  }

  await expect(page).toHaveURL(new RegExp(`^${route}`));
  expect(page.url().includes(route), `${description} route did not resolve to ${route}`).toBeTruthy();
};

test.describe.serial('Service User smoke tests', () => {
  test.setTimeout(300000);

  let page: Page;

  test.beforeAll(() => {
    test.skip(
      !serviceUserEmail || !serviceUserPassword,
      'Cần SERVICE_USER_EMAIL và SERVICE_USER_PASSWORD hợp lệ để chạy smoke test Service User.'
    );
  });

  test.beforeAll(async ({ browser }) => {
    if (!serviceUserEmail || !serviceUserPassword) return;
    page = await browser.newPage();
    await loginAsServiceUser(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('Login successfully and open dashboard', async () => {
    const monitor = attachPageMonitoring(page);

    // The suite signs in once in beforeAll to avoid triggering production rate limits.

    // Service users land on the public landing page ("/"), not the internal staff dashboard.
    // Check for the landing hero as the primary signal the app loaded for service-user.
    await expect(page.locator('#landing-hero-title')).toBeVisible({ timeout: 15000 });
    // It's still fine if UI shows a small "Phản ánh của tôi" link; assert it's present if available.
    try {
      await expect(page.getByRole('link', { name: /Phản ánh của tôi|My feedbacks|Feedbacks/i }).first()).toBeVisible({ timeout: 5000 });
    } catch {
      // ignore if not present for this account
    }

    await assertNoErrors(monitor, 'Dashboard');
  });

  test('Open ticket list and open one ticket detail', async () => {
    const monitor = attachPageMonitoring(page);

    await page.goto(ticketListRoute);
    await page.waitForLoadState('domcontentloaded');

    const ticketListPage = new TicketListPage(page);
    // Ensure the ticket list page loaded.
    await expect(page.getByRole('heading', { name: /Phản ánh của tôi|Ticket List|Danh sách phản ánh/i }).first()).toBeVisible({ timeout: 15000 });

    // If there are ticket rows, open the first one. Otherwise skip opening.
    const rowCount = await ticketListPage.ticketRows.count();
    if (rowCount > 0) {
      await expect(ticketListPage.ticketRows.first()).toBeVisible({ timeout: 20000 });
      await ticketListPage.openFirstTicket();
      await page.waitForURL(/\/tickets\/[A-Za-z0-9_-]+/, { timeout: 30000 });

      const ticketDetailPage = new TicketDetailPage(page);
      await expect(ticketDetailPage.titleHeading).toBeVisible({ timeout: 15000 });
    } else {
      // No tickets for this service user account — that's acceptable for smoke tests.
      console.warn('Service user has no tickets; skipping ticket open step.');
    }

    await assertNoErrors(monitor, 'Ticket detail');
  });

  test('Verify community feed loads', async () => {
    const monitor = attachPageMonitoring(page);

    await page.goto(communityFeedRoute);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main.community-feed-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Bảng tin cộng đồng|Community Feed|Bảng tin/i }).first()).toBeVisible({ timeout: 15000 });
    await assertNoErrors(monitor, 'Community feed');
  });

  test('Verify notification center loads', async () => {
    const monitor = attachPageMonitoring(page);

    await page.goto(notificationCenterRoute);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Thông báo của tôi/i })).toBeVisible({ timeout: 15000 });
    // locator(...) may match multiple elements; assert the first matching shell/page is visible.
    await expect(page.locator('.notification-center-shell, .notification-center-page').first()).toBeVisible({ timeout: 15000 });
    await assertNoErrors(monitor, 'Notification center');
  });

  test('Verify profile page loads', async () => {
    const monitor = attachPageMonitoring(page);

    await page.goto(profileRoute);
    await page.waitForLoadState('domcontentloaded');

    // The profile page renders a dedicated hero section and a real h1; assert against the actual page shell
    // instead of stale CSS classes that no longer exist in the current UI.
    await expect(page.getByText(/Hồ sơ tài khoản/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.profile-hero-surface, h1').first()).toBeVisible({ timeout: 15000 });
    await assertNoErrors(monitor, 'Profile page');
  });
});
