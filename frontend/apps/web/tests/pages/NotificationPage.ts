import { Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class NotificationPage extends BasePage {
  readonly bellButton;
  readonly notificationItems;
  readonly markAllButton;
  readonly unreadBadge;

  constructor(page: Page) {
    super(page);
    this.bellButton = page.locator('label.btn.btn-ghost.btn-circle').first();
    this.notificationItems = page.locator('.dropdown-content .card-body button');
    this.markAllButton = page.locator('button', { hasText: /Đánh dấu tất cả/ });
    this.unreadBadge = page.locator('.badge.badge-xs.badge-error, .indicator-item');
  }

  async openNotifications() {
    await this.bellButton.click();
  }
}
