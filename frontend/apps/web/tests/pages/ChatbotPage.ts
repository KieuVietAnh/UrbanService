import { Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class ChatbotPage extends BasePage {
  readonly chatInput;
  readonly sendButton;
  readonly messages;
  readonly hintButtons;

  constructor(page: Page) {
    super(page);
    this.chatInput = page.locator('input[placeholder="Nhập tin nhắn..."]');
    this.sendButton = page.locator('button', { hasText: /^Gửi$/ }).last();
    this.messages = page.locator('.chat-bubble');
    this.hintButtons = page.locator('button.badge');
  }

  async sendMessage(message: string) {
    await this.chatInput.fill(message);
    await this.sendButton.click();
  }
}
