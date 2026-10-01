import { Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class DashboardPage extends BasePage {
  readonly dashboardHeading;
  readonly createTicketCard;
  readonly ticketListCard;
  readonly mapCard;

  constructor(page: Page) {
    super(page);
    this.dashboardHeading = page.locator('#citizen-dashboard-title, h1, h2').filter({ hasText: /Chào,|Tổng quan|Bản đồ/i });
    this.createTicketCard = page.locator('a', { hasText: /Gửi phản ánh/i });
    this.ticketListCard = page.locator('a', { hasText: /Xem tất cả|Phản ánh của tôi/ });
    this.mapCard = page.locator('a', { hasText: /Bản đồ sự cố|Báo cáo thống kê/ });
  }

  async expectLoaded() {
    try {
      await this.dashboardHeading.first().waitFor({ state: 'visible', timeout: 5000 });
      return;
    } catch (e) {
      // Semantic citizen header no longer uses the legacy .navbar class.
      await this.page
        .locator('header')
        .filter({ has: this.page.getByRole('link', { name: /UrbanMind|Về trang chủ UrbanMind/i }) })
        .first()
        .waitFor({ state: 'visible', timeout: 25000 });
    }
  }
}
