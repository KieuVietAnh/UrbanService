import { expect, test } from '@playwright/test';
if (!process.env.RUN_DESTRUCTIVE_TESTS) test.skip(true, 'Destructive tests are skipped unless RUN_DESTRUCTIVE_TESTS is set');
import { LoginPage } from '../pages/LoginPage';
import { FeedbackPage } from '../pages/FeedbackPage';

const validEmail = 'nguyengiauzxc@gmail.com';
const validPassword = 'nguyenhuugiau';

const testTitle = `E2E feedback test title ${Date.now()}`;
const testDescription = 'E2E feedback test description for automation.';

async function createFeedbackWithAttachment(page, apiPath, token, payload) {
  return await page.evaluate(async ({ apiPath, token, payload }) => {
    const file = new File(['Playwright evidence file'], 'e2e-sample.png', { type: 'image/png' });
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, String(item)));
      } else {
        formData.append(key, String(value));
      }
    });
    formData.append('attachments', file);

    const response = await fetch(apiPath, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      status: response.status,
      ok: response.ok,
      body: await response.text(),
    };
  }, { apiPath, token, payload });
}

test.describe('Feedback flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const loginPage = new LoginPage(page);
    await loginPage.login(validEmail, validPassword);
    await page.waitForURL('**/dashboard');
  });

  test('Create feedback and verify it appears in the ticket list', async ({ page }) => {
    const feedbackPage = new FeedbackPage(page);

    await page.goto('/tickets/create');
    await feedbackPage.fillStepOne(testTitle, testDescription);
    await feedbackPage.pickFirstCategory();
    await feedbackPage.selectLocation();
    await feedbackPage.goToUploadStep();
    await feedbackPage.uploadEvidence('tests/fixtures/sample.png');
    await feedbackPage.submitButton.click();
    await expect(feedbackPage.successHeading).toBeVisible({ timeout: 20000 });

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr', { hasText: testTitle })).toBeVisible({ timeout: 20000 });
  });
});
