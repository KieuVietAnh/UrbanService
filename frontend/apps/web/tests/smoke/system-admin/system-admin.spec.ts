import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const systemAdminEmail = 'anhkvse182347@fpt.edu.vn';
const systemAdminPassword = '123456789';

const usersRoute = '/management/users';
const feedbacksRoute = '/management/feedbacks';
const categoriesRoute = '/management/categories';
const slaRoute = '/management/sla';
const auditRoute = '/admin/audit';
const performanceRoute = '/admin/performance';

type PageMonitor = {
  pageErrors: string[];
  consoleErrors: string[];
  badResponses: string[];
};

const attachPageMonitoring = (page: Page): PageMonitor => {
  const monitor: PageMonitor = { pageErrors: [], consoleErrors: [], badResponses: [] };

  page.on('pageerror', (error) => monitor.pageErrors.push(error?.message || String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      monitor.consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && /\/api\//i.test(url)) {
      monitor.badResponses.push(`${status} ${response.request().method()} ${url}`);
    }
  });

  return monitor;
};

const assertNoErrors = async (
  monitor: PageMonitor,
  context: string,
  ignoreConsolePatterns: RegExp[] = [],
  ignoreBadResponsePatterns: RegExp[] = []
) => {
  const relevantPageErrors = monitor.pageErrors.filter((error) => !/Unexpected token '<'/.test(String(error)));
  expect(relevantPageErrors, `${context}: unexpected uncaught page errors`).toEqual([]);

  const consoleRelevant = monitor.consoleErrors.filter((message) => {
    if (!message) return false;
    if (/Unexpected token '<'/.test(message)) return false;
    if (/Failed to load resource: the server responded with a status of 405\./.test(message)) return false;
    if (/\b405\b/.test(message) && /Method Not Allowed/i.test(message)) return false;
    if (ignoreConsolePatterns.some((pattern) => pattern.test(message))) return false;
    return true;
  });
  expect(consoleRelevant, `${context}: unexpected console errors`).toEqual([]);

  const badRelevant = monitor.badResponses.filter((entry) => {
    if (/\b405\b/.test(entry)) return false;
    if (ignoreBadResponsePatterns.some((pattern) => pattern.test(entry))) return false;
    return true;
  });
  expect(badRelevant, `${context}: unexpected API failures`).toEqual([]);
};

const loginAsSystemAdmin = async (page: Page) => {
  await page.goto('/login');
  const loginPage = new LoginPage(page);
  await loginPage.login(systemAdminEmail, systemAdminPassword);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), undefined, { timeout: 30000 });
  await page.waitForSelector('.admin-page-hero, .admin-hero-title, .dashboard-shell, header', { timeout: 30000 }).catch(() => undefined);
};

const verifyRouteAndPage = async (
  page: Page,
  route: string,
  locator: string | ReturnType<Page['locator']>,
  description: string
) => {
  const pageLoadTimeout = 30000;

  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');

  if (typeof locator === 'string') {
    await expect(page.locator(locator)).toBeVisible({ timeout: pageLoadTimeout });
  } else {
    await expect(locator).toBeVisible({ timeout: pageLoadTimeout });
  }

  const currentPath = new URL(page.url()).pathname;
  expect(currentPath.includes(route), `${description} route did not resolve to ${route}`).toBeTruthy();
};

test.describe.serial('System Administrator smoke tests', () => {
  test.setTimeout(120000);

  let sharedPage: Page;
  let monitor: PageMonitor;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    monitor = attachPageMonitoring(sharedPage);
    await loginAsSystemAdmin(sharedPage);
  });

  test.beforeEach(() => {
    monitor.pageErrors.length = 0;
    monitor.consoleErrors.length = 0;
    monitor.badResponses.length = 0;
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test('Login successfully as administrator', async () => {
    const adminHeading = sharedPage
      .locator('h1, h2')
      .filter({ hasText: /Quản lý người dùng|Quản lý feedback|Quản lý phản ánh|Danh mục phản ánh|Cấu hình thời hạn SLA|Chính sách SLA|Nhật ký hệ thống|Hiệu năng/i })
      .first();
    const shellOrLogout = sharedPage.locator('button.admin-sidebar-logout, .dashboard-shell, .admin-page-hero').first();

    const headingVisible = await adminHeading.isVisible().catch(() => false);
    const shellVisible = await shellOrLogout.isVisible().catch(() => false);
    expect(
      headingVisible || shellVisible,
      'Administrator login did not reach an expected admin landing surface'
    ).toBeTruthy();
    await assertNoErrors(monitor, 'Administrator login');
  });

  test('User Management loads', async () => {
    await verifyRouteAndPage(sharedPage, usersRoute, sharedPage.getByRole('heading', { name: /Quản lý người dùng/i }), 'User Management');
    await assertNoErrors(monitor, 'User Management');
  });

  test('Feedback Management loads', async () => {
    await verifyRouteAndPage(sharedPage, feedbacksRoute, sharedPage.getByRole('heading', { name: /Quản lý feedback|Quản lý phản ánh/i }), 'Feedback Management');
    await assertNoErrors(monitor, 'Feedback Management');
  });

  test('Category Management loads', async () => {
    await verifyRouteAndPage(sharedPage, categoriesRoute, sharedPage.getByRole('heading', { name: /Danh mục phản ánh/i }), 'Category Management');
    await assertNoErrors(
      monitor,
      'Category Management',
      [/Failed to load resource: the server responded with a status of 404 \(Not Found\)/],
      [/404 .*\/api\/management\/categories/]
    );
  });

  test('SLA Configuration loads', async () => {
    await verifyRouteAndPage(sharedPage, slaRoute, sharedPage.getByRole('heading', { name: 'Chính sách SLA', exact: true }), 'SLA Configuration');
    await assertNoErrors(
      monitor,
      'SLA Configuration',
      [/Failed to load resource: the server responded with a status of 404 \(Not Found\)/],
      [/404 .*\/api\/management\/sla/, /404 .*\/api\/management\/sla-config/]
    );
  });

  test('Retired Audit Log route redirects to the admin dashboard', async () => {
    await sharedPage.goto(auditRoute);
    await expect(sharedPage).toHaveURL(/\/dashboard\/?$/, { timeout: 30000 });
    await expect(sharedPage.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
    await assertNoErrors(monitor, 'Retired Audit Log redirect');
  });

  test('Retired Performance route redirects to the admin dashboard', async () => {
    await sharedPage.goto(performanceRoute);
    await expect(sharedPage).toHaveURL(/\/dashboard\/?$/, { timeout: 30000 });
    await expect(sharedPage.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
    await assertNoErrors(monitor, 'Retired Performance redirect');
  });
});
