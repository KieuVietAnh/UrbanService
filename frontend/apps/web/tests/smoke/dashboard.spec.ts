import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const systemStaffEmail = process.env.SYSTEM_STAFF_EMAIL || 'kvietanh123@gmail.com';
const validPassword = process.env.SYSTEM_STAFF_PASSWORD || '123456789';
const expectAssignedIncidents = process.env.EXPECT_STAFF_INCIDENTS === 'true';

const loginAs = async (page, email: string, password: string) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
};

test.describe('System Staff smoke tests', () => {
  test.setTimeout(300000);
  test('System Staff Incident dashboard loads successfully', async ({ page }) => {
    await loginAs(page, systemStaffEmail, validPassword);
    // First confirm we left the /login page (handles slow auth responses)
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), undefined, { timeout: 60000 });
    // Then wait for the app to redirect to /dashboard
    await page.waitForURL(/\/dashboard(?:[/?#]|$)/, { timeout: 60000 });

    await expect(page.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible({ timeout: 30000 });
    const kpiHeading = page.getByRole('heading', { name: 'Nhịp công việc hiện tại' });
    const emptyState = page.getByText('Bạn chưa có sự vụ nào được phân công', { exact: true });
    await expect(expectAssignedIncidents ? kpiHeading : kpiHeading.or(emptyState)).toBeVisible({ timeout: 30000 });
    if (await kpiHeading.isVisible()) {
      await expect(page.getByRole('heading', { name: 'Sự vụ cần chú ý' })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /Xem tất cả sự vụ/i }).first()).toBeVisible();
    const mainContent = page.getByRole('main').first();
    await expect(mainContent.getByText(/Hàng Chờ Kiểm Duyệt AI/i)).toHaveCount(0);
    await expect(mainContent).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Xem tất cả sự vụ/i }).first()).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
