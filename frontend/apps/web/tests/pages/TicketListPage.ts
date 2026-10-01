import { Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class TicketListPage extends BasePage {
  readonly ticketRows;
  readonly searchInput;
  readonly statusFilter;
  readonly categoryFilter;

  constructor(page: Page) {
    super(page);
    this.ticketRows = page.locator('table tbody tr');
    this.searchInput = page.locator('input[placeholder*="Tìm"]');
    this.statusFilter = page.locator('select').first();
    this.categoryFilter = page.locator('select').nth(1);
  }

  async openFirstTicket() {
    const firstTicket = this.ticketRows.first();
    await firstTicket.locator('button[title="Xem chi tiết"]').click();
  }
}
