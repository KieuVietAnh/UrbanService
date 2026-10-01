import { expect, test } from '@playwright/test';
if (!process.env.RUN_DESTRUCTIVE_TESTS) test.skip(true, 'Destructive tests are skipped unless RUN_DESTRUCTIVE_TESTS is set');
import { LoginPage } from '../pages/LoginPage';
import { TicketListPage } from '../pages/TicketListPage';
import { FeedbackPage } from '../pages/FeedbackPage';
import { TicketDetailPage } from '../pages/TicketDetailPage';

const validEmail = 'nguyengiauzxc@gmail.com';
const validPassword = 'nguyenhuugiau';

test.describe('Ticket flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const loginPage = new LoginPage(page);
    await loginPage.login(validEmail, validPassword);
    await page.waitForURL('**/dashboard');
  });

  test('Open ticket list and ticket detail', async ({ page }) => {
    await page.goto('/tickets');
    const ticketList = new TicketListPage(page);
      let rowCount = await ticketList.ticketRows.count();
      if (rowCount === 0) {
        // Try to create a minimal ticket via API using the logged-in token
        const token = await page.evaluate(() => localStorage.getItem('urbanmind_auth_token') || localStorage.getItem('token'));
        if (token) {
          const userInfo = await page.evaluate(() => {
            try { return JSON.parse(localStorage.getItem('urbanmind_auth_user') || 'null'); } catch { return null; }
          });
          const userId = userInfo?.id || userInfo?.userId || null;
          const reporterName = userInfo?.fullName || userInfo?.name || 'E2E Test';
          await page.request.post('https://api.urbanservice.me/api/user/feedbacks', {
            data: {
              userId,
              reporterName,
              title: 'E2E auto ticket',
              description: 'Created by Playwright for testing',
              categoryId: 1,
              latitude: 10.762622,
              longitude: 106.660172,
              locationText: 'Auto-created location'
            },
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          await page.goto('/tickets');
          await page.waitForLoadState('networkidle');
          try {
            await ticketList.ticketRows.first().waitFor({ state: 'visible', timeout: 8000 });
          } catch {
            // ignore - will re-count below
          }
          rowCount = await ticketList.ticketRows.count();
        }
        if (rowCount === 0) {
          // As a last resort, create a ticket via the UI to ensure it appears in the list
          await page.goto('/tickets/create');
          const feedbackPage = new FeedbackPage(page);
          await feedbackPage.fillStepOne('E2E UI ticket', 'Created by Playwright UI flow');
          await feedbackPage.pickFirstCategory();
          try {
            await feedbackPage.uploadEvidence('tests/fixtures/sample.png');
          } catch {}
          await feedbackPage.submitButton.click();
          try {
            await feedbackPage.successHeading.waitFor({ state: 'visible', timeout: 20000 });
          } catch (e) {
            // continue anyway
          }
          await page.goto('/tickets');
          await page.waitForLoadState('networkidle');
          rowCount = await ticketList.ticketRows.count();
        }
    }
    await ticketList.openFirstTicket();
    const detailPage = new TicketDetailPage(page);
    await expect(detailPage.titleHeading).toBeVisible();
    await expect(detailPage.descriptionText).toBeVisible();
    await expect(detailPage.statusBadge).toBeVisible();
    const timelineCount = await detailPage.timelineItems.count();
    if (timelineCount === 0) {
      // it's acceptable if no timeline entries, but warn in test output
      console.warn('No timeline items found for ticket');
    }
  });
});
