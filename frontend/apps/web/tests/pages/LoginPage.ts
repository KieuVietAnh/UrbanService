import { Locator, Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly quickLoginButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.submitButton = page.getByRole('button', { name: /Đăng nhập/i }).first();
    this.errorMessage = page.getByRole('alert');
    this.quickLoginButtons = page.locator('button', { hasText: /Administrator|System Staff|Interaction Manager|Service Operator/ });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const loginResponsePromise = this.page
        .waitForResponse(
          (response) => {
            const url = new URL(response.url());
            return response.request().method() === 'POST' && url.pathname.endsWith('/api/auth/login');
          },
          { timeout: 45000 }
        )
        .catch(() => null);

      await this.submitButton.click();
      const loginResponse = await loginResponsePromise;
      const alertText = await this.errorMessage.first().innerText().catch(() => '');
      const isRateLimited =
        loginResponse?.status() === 429 ||
        /quá nhiều lần|too many.*attempt|rate.?limit/i.test(alertText);

      if (!isRateLimited || attempt === maxAttempts) {
        return;
      }

      // Production throttles repeated role logins from the same CI runner/IP.
      // Wait for the server window to expire, then submit the same credentials.
      console.warn(`[LoginPage] Login throttled for ${email}; retrying after cooldown (${attempt}/${maxAttempts - 1}).`);
      await this.page.waitForTimeout(35000);
    }
  }

  async fillInvalidCredentials() {
    await this.emailInput.fill('invalid@example.com');
    await this.passwordInput.fill('wrongpassword');
    await this.submitButton.click();
  }
}
