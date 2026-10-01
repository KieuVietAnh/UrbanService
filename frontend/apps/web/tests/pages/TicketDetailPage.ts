import { Locator, Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class TicketDetailPage extends BasePage {
  readonly titleHeading: Locator;
  readonly descriptionText: Locator;
  readonly categoryBadge: Locator;
  readonly statusBadge: Locator;
  readonly timelineItems: Locator;
  readonly chatInput: Locator;
  readonly chatSendButton: Locator;
  readonly chatMessages: Locator;

  constructor(page: Page) {
    super(page);
    this.titleHeading = page.locator('h2').first();
    this.descriptionText = page.locator('span', { hasText: /Mô tả của người dân/ }).locator('..').locator('p');
    this.categoryBadge = page.locator('span.badge, .badge');
    this.statusBadge = page.locator('span', { hasText: /Trạng thái:/ });
    this.timelineItems = page.locator('.card .space-y-4').last().locator('div');
    this.chatInput = page.locator('input[placeholder="Nhập tin nhắn..."]');
    this.chatSendButton = page.locator('button', { hasText: /Gửi/ }).last();
    this.chatMessages = page.locator('.chat-bubble');
  }

  async open() {
    await this.page.waitForLoadState('networkidle');
  }

  async sendChatMessage(message: string) {
    await this.chatInput.fill(message);
    await this.chatSendButton.click();
  }
}
