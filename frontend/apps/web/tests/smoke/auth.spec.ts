import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const administratorEmail = 'anhkvse182347@fpt.edu.vn';
const validPassword = '123456789';
const invalidEmail = 'invalid@example.com';
const invalidPassword = 'wrongpassword';

const loginAs = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
};

test.describe('Authentication smoke tests', () => {
  test.setTimeout(180000);

  test('Administrator can log in and load the admin shell', async ({ page }) => {
    await loginAs(page, administratorEmail, validPassword);
    await page.waitForFunction(() => window.location.pathname !== '/login', undefined, { timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('Invalid credentials show login error', async ({ page }) => {
    await page.goto('/login');
    const loginPage = new LoginPage(page);
    await loginPage.emailInput.fill(invalidEmail);
    await loginPage.passwordInput.fill(invalidPassword);
    await loginPage.submitButton.click();
    await expect(loginPage.errorMessage).toContainText(/Lỗi đăng nhập|Email hoặc mật khẩu|Đăng nhập thất bại|Sai|invalid|Unauthorized/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('Logout returns to login screen', async ({ page }) => {
    await loginAs(page, administratorEmail, validPassword);
    await page.waitForFunction(() => window.location.pathname !== '/login', undefined, { timeout: 30000 });

    const sidebarLogoutButton = page.getByRole('button', { name: 'Đăng xuất', exact: true });
    await expect(sidebarLogoutButton).toBeVisible();
    await sidebarLogoutButton.click();

    const logoutDialog = page
      .getByRole('dialog', { name: 'Xác nhận đăng xuất' })
      .or(page.locator('.modal-box').filter({ hasText: 'Xác nhận đăng xuất' }))
      .first();
    const confirmLogoutButton = logoutDialog.getByRole('button', { name: 'Đăng xuất', exact: true });
    await expect(confirmLogoutButton).toBeVisible();
    await confirmLogoutButton.click();

    await page.waitForURL(/\/login/, { timeout: 20000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
