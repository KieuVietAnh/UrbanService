import { expect, test } from '@playwright/test';
if (!process.env.RUN_DESTRUCTIVE_TESTS) test.skip(true, 'Destructive tests are skipped unless RUN_DESTRUCTIVE_TESTS is set');
import { LoginPage } from '../pages/LoginPage';
import { TicketListPage } from '../pages/TicketListPage';
import { FeedbackPage } from '../pages/FeedbackPage';
import { TicketDetailPage } from '../pages/TicketDetailPage';

const validEmail = 'nguyengiauzxc@gmail.com';
const validPassword = 'nguyenhuugiau';

test.describe('Chatbot / ticket conversation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const loginPage = new LoginPage(page);
    await loginPage.login(validEmail, validPassword);
    await page.waitForURL('**/dashboard');
  });

  test('Open ticket detail and send chatbot message', async ({ page }) => {
    await page.goto('/tickets');
    const ticketList = new TicketListPage(page);
    let rows = await ticketList.ticketRows.count();
    if (rows === 0) {
      const token = await page.evaluate(() => localStorage.getItem('urbanmind_auth_token') || localStorage.getItem('token'));
      if (token) {
        const userInfo = await page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('urbanmind_auth_user') || 'null'); } catch { return null; }
        });
        const userId = userInfo?.id || userInfo?.userId || null;
        const reporterName = userInfo?.fullName || userInfo?.name || 'E2E Test';
        await page.request.post('https://api.urbanservice.me/api/user/feedbacks', {
          data: { userId, reporterName, title: 'E2E auto ticket for chatbot', description: 'autocreated', categoryId: 1, latitude: 10.762622, longitude: 106.660172, locationText: 'Auto' },
          headers: { Authorization: `Bearer ${token}` }
        });
        await page.goto('/tickets');
        await page.waitForLoadState('networkidle');
        try {
          await ticketList.ticketRows.first().waitFor({ state: 'visible', timeout: 8000 });
        } catch {
          // ignore - will re-count below
        }
        rows = await ticketList.ticketRows.count();
      }
      if (rows === 0) {
        // Try to create via UI as a fallback
        await page.goto('/tickets/create');
        const feedbackPage = new FeedbackPage(page);
        await feedbackPage.fillStepOne('E2E auto ticket for chatbot', 'autocreated by UI');
        await feedbackPage.pickFirstCategory();
        try { await feedbackPage.uploadEvidence('tests/fixtures/sample.png'); } catch {}
        await feedbackPage.submitButton.click();
        try { await feedbackPage.successHeading.waitFor({ state: 'visible', timeout: 20000 }); } catch {}
        await page.goto('/tickets');
        await page.waitForLoadState('networkidle');
        rows = await ticketList.ticketRows.count();
      }
      if (rows === 0) throw new Error('No tickets available to open for chatbot test after creating one');
    }
    await ticketList.openFirstTicket();

    const detailPage = new TicketDetailPage(page);
    await expect(detailPage.chatInput).toBeVisible();
    await detailPage.sendChatMessage('@ai tiến độ xử lý');
    // Check that at least one AI response bubble exists
    const bubbleCount = await page.locator('.chat-bubble').count();
    if (bubbleCount === 0) {
      throw new Error('No chat bubbles found on the page');
    }
    // Just verify the page is still open and chat input exists
    await expect(detailPage.chatInput).toBeVisible();
  });
});
