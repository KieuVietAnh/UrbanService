import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const interactionManagerEmail = 'xbg4623@gmail.com';
const interactionManagerPassword = '123456789';

const interactionsRoute = '/manager/interactions';
const approvalsRoute = '/manager/approvals';
const slaRoute = '/analytics/sla';
const sentimentRoute = '/analytics/sentiment';
const heatmapRoute = '/analytics/heatmap';

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

const assertNoErrors = async (monitor: PageMonitor, context: string) => {
  const relevantPageErrors = monitor.pageErrors.filter((error) => !/Unexpected token '<'/.test(String(error)));
  expect(relevantPageErrors, `${context}: unexpected uncaught page errors`).toEqual([]);

  const consoleRelevant = monitor.consoleErrors.filter((message) => {
    if (!message) return false;
    if (/Unexpected token '<'/.test(message)) return false;
    if (/Failed to load resource: the server responded with a status of 405/.test(message)) return false;
    if (/\b405\b/.test(message) && /Method Not Allowed/i.test(message)) return false;
    return true;
  });
  expect(consoleRelevant, `${context}: unexpected console errors`).toEqual([]);

  const badRelevant = monitor.badResponses.filter((entry) => !/\b405\b/.test(entry));
  expect(badRelevant, `${context}: unexpected API failures`).toEqual([]);
};

const loginAsInteractionManager = async (page: Page) => {
  await page.goto('/login');
  const loginPage = new LoginPage(page);
  await loginPage.login(interactionManagerEmail, interactionManagerPassword);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), undefined, { timeout: 30000 });
  await page.waitForSelector('.admin-page-hero, .admin-hero-title, .dashboard-shell, header', { timeout: 30000 }).catch(() => undefined);
};

const verifyRouteAndPage = async (page: Page, route: string, locator: string | ReturnType<Page['locator']>, description: string) => {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');

  if (typeof locator === 'string') {
    await expect(page.locator(locator)).toBeVisible({ timeout: 15000 });
  } else {
    await expect(locator).toBeVisible({ timeout: 15000 });
  }

  const currentPath = new URL(page.url()).pathname;
  expect(currentPath.includes(route), `${description} route did not resolve to ${route}`).toBeTruthy();
};

test.describe.serial('Interaction Manager smoke tests', () => {
  test.setTimeout(120000);

  let sharedPage: Page;
  let monitor: PageMonitor;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    monitor = attachPageMonitoring(sharedPage);
    await loginAsInteractionManager(sharedPage);
  });

  test.beforeEach(() => {
    monitor.pageErrors.length = 0;
    monitor.consoleErrors.length = 0;
    monitor.badResponses.length = 0;
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test('Login successfully and open interaction monitoring', async () => {
    await verifyRouteAndPage(
      sharedPage,
      interactionsRoute,
      sharedPage.getByRole('heading', { name: 'Giám sát phản ánh', exact: true }),
      'interaction monitoring'
    );

    await assertNoErrors(monitor, 'Interaction monitoring');
  });

  test('Open approval inbox', async () => {
    await verifyRouteAndPage(
      sharedPage,
      approvalsRoute,
      sharedPage.getByRole('heading', { name: 'Duyệt kết quả xử lý', exact: true }),
      'approval inbox'
    );

    await assertNoErrors(monitor, 'Approval inbox');
  });

  test('Open approval detail from first available item', async () => {
    await sharedPage.goto(approvalsRoute);
    await sharedPage.waitForLoadState('domcontentloaded');

    const rowCount = await sharedPage.locator('table tbody tr').count();
    if (rowCount === 0) {
      console.log('No approval items available — skipping detail check.');
      return;
    }

    const firstRow = sharedPage.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 20000 });

    await firstRow.click();
    await sharedPage.waitForURL(/\/manager\/approvals\/[A-Za-z0-9_-]+/, { timeout: 30000 });

    await expect(sharedPage.getByRole('button', { name: /Quay lại|Quay lại danh sách/i })).toBeVisible({ timeout: 15000 });
    await assertNoErrors(monitor, 'Approval detail');
  });

  test('Open SLA analytics dashboard', async () => {
    await verifyRouteAndPage(
      sharedPage,
      slaRoute,
      sharedPage.getByRole('heading', { name: 'Phân tích SLA sự vụ', exact: true }),
      'SLA analytics'
    );

    await assertNoErrors(monitor, 'SLA analytics');
  });

  test('Open sentiment dashboard', async () => {
    await verifyRouteAndPage(
      sharedPage,
      sentimentRoute,
      sharedPage.getByRole('heading', { name: 'Cảm xúc người dân', exact: true }),
      'sentiment dashboard'
    );

    await assertNoErrors(monitor, 'Sentiment dashboard');
  });

  test('Open heatmap dashboard', async () => {
    await verifyRouteAndPage(
      sharedPage,
      heatmapRoute,
      sharedPage.getByRole('heading', { name: 'Bản đồ điểm nóng', exact: true }),
      'heatmap dashboard'
    );

    await assertNoErrors(monitor, 'Heatmap dashboard');
  });
});
