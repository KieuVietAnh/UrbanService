import { expect, test } from '@playwright/test';
if (!process.env.RUN_DESTRUCTIVE_TESTS) test.skip(true, 'Destructive tests are skipped unless RUN_DESTRUCTIVE_TESTS is set');
import { LoginPage } from '../pages/LoginPage';
import { NotificationPage } from '../pages/NotificationPage';

const validEmail = 'nguyengiauzxc@gmail.com';
const validPassword = 'nguyenhuugiau';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const loginPage = new LoginPage(page);
    await loginPage.login(validEmail, validPassword);
    await page.waitForURL('**/dashboard');
  });

  test('Load notifications and mark as read', async ({ page }) => {
    const notificationPage = new NotificationPage(page);
    await notificationPage.openNotifications();
    await expect(notificationPage.notificationItems.first()).toBeVisible();
    const initialCount = await notificationPage.unreadBadge.count();
    if (initialCount > 0) {
      await notificationPage.markAllButton.click();
      await expect(notificationPage.unreadBadge).toHaveCount(0);
    }
  });
});
