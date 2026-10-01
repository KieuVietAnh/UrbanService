import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const staffEmail = process.env.STAFF_EMAIL;
const staffPassword = process.env.STAFF_PASSWORD;

const loginAsStaff = async (page: Page) => {
  await page.goto('/login');
  const loginPage = new LoginPage(page);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login'),
    { timeout: 30000 },
  ).catch(() => null);
  await loginPage.login(staffEmail!, staffPassword!);
  const loginResponse = await loginResponsePromise;

  if (loginResponse && !loginResponse.ok()) {
    const responseText = await loginResponse.text().catch(() => '');
    throw new Error(`API đăng nhập trả ${loginResponse.status()}: ${responseText.slice(0, 300)}`);
  }

  const loginError = page
    .locator('.alert.alert-error, .text-red-600')
    .or(page.getByText(/Lỗi đăng nhập|Đăng nhập thất bại/i));
  if (await loginError.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    throw new Error((await loginError.first().innerText()).trim());
  }

  await page.waitForFunction(() => window.location.pathname !== '/login', undefined, { timeout: 30000 });
};

const expectNoManagerActions = async (page: Page) => {
  const forbiddenActions = page.getByRole('button', {
    name: /Xác nhận phản ánh|Từ chối phản ánh|Cùng sự vụ|Khác sự vụ|Phân công Staff|Phê duyệt|Yêu cầu xử lý lại|Đóng sự vụ/i,
  });
  await expect(forbiddenActions).toHaveCount(0);
};

test.describe.serial('SYSTEMSTAFF — luồng Incident', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    if (!staffEmail || !staffPassword) {
      // Signal that all tests in this suite should be skipped
      test.skip(true, 'Cần STAFF_EMAIL và STAFF_PASSWORD để chạy smoke test SYSTEMSTAFF.');
    }
  });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    if (!staffEmail || !staffPassword) return;
    sharedPage = await browser.newPage();
    await loginAsStaff(sharedPage);
  });

  test.afterAll(async () => {
    if (sharedPage) await sharedPage.close();
  });

  test('đăng nhập mở Dashboard theo sự vụ', async () => {
    await expect(sharedPage).toHaveURL(/\/dashboard\/?$/);
    await expect(sharedPage.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible();
    await expect(sharedPage.getByRole('link', { name: /Xem tất cả sự vụ/i }).first()).toBeVisible();
    await expect(sharedPage.getByText(/Hàng chờ kiểm duyệt AI|Xử lý trùng lặp/i)).toHaveCount(0);
  });

  test('Sự vụ của tôi tải đúng bộ lọc và phân trang backend', async () => {
    await sharedPage.goto('/staff/incidents');

    await expect(sharedPage.getByRole('heading', { name: 'Sự vụ của tôi' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Tất cả' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Được phân công' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Đang xử lý' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Cần xử lý lại' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Chờ duyệt' })).toBeVisible();
    await expect(sharedPage.getByLabel('Tìm kiếm')).toBeVisible();
    await expect(sharedPage.getByLabel('Trạng thái')).toBeVisible();
    await expect(sharedPage.getByLabel('Mức ưu tiên')).toBeVisible();
    await expect(sharedPage.getByLabel('Độ nghiêm trọng')).toBeVisible();
    await expect(sharedPage.getByLabel('Phường / Khu vực')).toBeVisible();
    await expect(sharedPage.getByLabel('Danh mục')).toBeVisible();

    const pagination = sharedPage.getByRole('navigation', { name: 'Phân trang danh sách sự vụ được giao' });
    if (await pagination.isVisible().catch(() => false)) {
      await expect(pagination.getByRole('button', { name: 'Trang trước' })).toBeVisible();
      await expect(pagination.getByRole('button', { name: 'Trang sau' })).toBeVisible();
    }
  });

  test('chi tiết Incident có đủ năm tab và không lộ quyền Manager', async () => {
    await sharedPage.goto('/staff/incidents');

    const firstIncidentLink = sharedPage.locator('a[href^="/staff/incidents/"]').first();
    await expect(firstIncidentLink, 'Tài khoản Staff đã có Incident được phân công nhưng danh sách không hiển thị liên kết chi tiết.').toBeVisible({ timeout: 20000 });
    await firstIncidentLink.click();
    await expect(sharedPage).toHaveURL(/\/staff\/incidents\/[0-9a-f-]+/i);
    const tablist = sharedPage.getByRole('tablist', { name: 'Nội dung chi tiết sự vụ' });
    await expect(tablist).toBeVisible();

    for (const tabName of ['Tổng quan', 'Các phản ánh', 'Dòng thời gian', 'Xử lý', 'Kết quả xử lý']) {
      await expect(tablist.getByRole('tab', { name: new RegExp(`^${tabName}(?: \\(\\d+\\))?$`) })).toBeVisible();
    }

    await expectNoManagerActions(sharedPage);

    const tabChecks = [
      { tab: /Các phản ánh/, heading: 'Danh sách phản ánh' },
      { tab: 'Dòng thời gian', heading: 'Dòng thời gian sự vụ' },
      { tab: 'Xử lý', heading: 'Flow xử lý sự vụ' },
      { tab: 'Kết quả xử lý', heading: 'Kết quả đã nhận' },
    ];

    for (const { tab, heading } of tabChecks) {
      await tablist.getByRole('tab', { name: tab, exact: typeof tab === 'string' }).click();
      await expect(sharedPage.getByRole('tabpanel')).toBeVisible();
      await expect(sharedPage.getByRole('heading', { name: heading }).first()).toBeVisible();
      await expectNoManagerActions(sharedPage);
    }

    await tablist.getByRole('tab', { name: 'Kết quả xử lý', exact: true }).click();
    await expect(sharedPage.getByRole('button', { name: /Gửi (lại )?kết quả|Tải minh chứng/i })).toHaveCount(0);

    const overviewTab = tablist.getByRole('tab', { name: 'Tổng quan', exact: true });
    await overviewTab.click();
    await overviewTab.focus();
    await sharedPage.keyboard.press('ArrowRight');
    await expect(tablist.getByRole('tab', { name: /Các phản ánh/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('Dashboard, danh sách và chi tiết dùng được ở viewport hẹp', async () => {
    await sharedPage.setViewportSize({ width: 768, height: 900 });

    await expect(sharedPage.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible();

    await sharedPage.goto('/staff/incidents');
    await expect(sharedPage.getByRole('heading', { name: 'Sự vụ của tôi' })).toBeVisible();
    const firstIncidentLink = sharedPage.locator('a[href^="/staff/incidents/"]:visible').first();
    await expect(firstIncidentLink).toBeVisible();
    await firstIncidentLink.click();
    await expect(sharedPage.getByRole('tablist', { name: 'Nội dung chi tiết sự vụ' })).toBeVisible();
    await expectNoManagerActions(sharedPage);
  });

  test('chi tiết phản ánh chỉ cung cấp ngữ cảnh và liên kết về Incident', async () => {
    await sharedPage.goto('/staff/incidents');
    await sharedPage.locator('a[href^="/staff/incidents/"]').first().click();

    const reportsTab = sharedPage.getByRole('tab', { name: /Các phản ánh/ });
    await reportsTab.click();
    const reportLink = sharedPage.getByRole('link', { name: 'Xem phản ánh' }).first();
    await expect(reportLink).toBeVisible();
    await reportLink.click();

    await expect(sharedPage).toHaveURL(/\/staff\/feedbacks\/[0-9a-f-]+/i);
    await expect(sharedPage.getByRole('tablist', { name: 'Nội dung chi tiết phản ánh' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Sự vụ liên quan' })).toBeVisible();
    await expect(sharedPage.getByRole('link', { name: 'Xem chi tiết sự vụ' })).toBeVisible();
    await expectNoManagerActions(sharedPage);
  });

  test('các route quyết định cũ chuyển về màn Staff an toàn', async () => {
    const redirects = [
      ['/staff/queue', '/staff/feedbacks'],
      ['/staff/duplicates/candidate-legacy', '/staff/incidents'],
      ['/tickets/assign/report-legacy', '/staff/incidents'],
      ['/staff/provider-reports/999999', '/staff/incidents'],
      ['/staff/provider-candidates-checker', '/staff/coordinators'],
    ];

    for (const [route, destination] of redirects) {
      await sharedPage.goto(route);
      await expect(sharedPage).toHaveURL(new RegExp(`${destination.replaceAll('/', '\\/')}\\/?$`));
    }
  });

  test('Staff bị chặn khỏi route Manager và Admin', async () => {
    const blockedRoutes = [
      '/manager/reports/review',
      '/manager/incident-matches',
      '/manager/incidents',
      '/manager/approvals',
      '/admin/audit',
    ];

    for (const route of blockedRoutes) {
      await sharedPage.goto(route);
      await sharedPage.waitForTimeout(300);
      expect(new URL(sharedPage.url()).pathname).not.toBe(route);
    }
  });
});
