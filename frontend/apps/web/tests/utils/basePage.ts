import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  async getTitle() {
    return this.page.title();
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }
}
