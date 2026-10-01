import { expect, Page } from '@playwright/test';
import { BasePage } from '../utils/basePage';

export class FeedbackPage extends BasePage {
  readonly titleInput;
  readonly descriptionInput;
  readonly nextButton;
  readonly stepOneHeading;
  readonly categorySelect;
  readonly locationPickerContainer;
  readonly uploadInput;
  readonly submitButton;
  readonly successHeading;

  constructor(page: Page) {
    super(page);
    this.titleInput = page.locator('input[type="text"]').first();
    this.descriptionInput = page.locator('textarea').first();
    this.stepOneHeading = page.locator('h3', { hasText: /Bước 1: Mô Tả Sự Cố/ });
    this.nextButton = page.locator('button', { hasText: /Tiếp Tục \(AI Phân Tích\)/ });
    this.categorySelect = page.locator('select').first();
    this.continueToLocationButton = page.locator('button', { hasText: /Tiếp Tục Chọn Vị Trí/ }).first();
    this.locationPickerContainer = page.locator('.leaflet-container').first();
    this.uploadStepButton = page.locator('button', { hasText: /Tải Ảnh Minh Chứng/ }).first();
    this.uploadInput = page.locator('input[type="file"]').first();
    this.submitButton = page.locator('button', { hasText: /Gửi Phản Ánh Ngay/ }).first();
    this.successHeading = page.locator('text=Gửi Phản Ánh Thành Công!');
  }

  async fillStepOne(title: string, description: string) {
    await this.stepOneHeading.first().waitFor({ state: 'visible', timeout: 30000 });
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
    await this.nextButton.click();
  }

  async pickFirstCategory() {
    await this.categorySelect.selectOption({ index: 0 });
    await this.continueToLocationButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.continueToLocationButton.click();
  }

  async selectLocation() {
    await this.locationPickerContainer.waitFor({ state: 'visible', timeout: 20000 });
    await this.locationPickerContainer.click({ position: { x: 150, y: 150 } });
  }

  async goToUploadStep() {
    await this.uploadStepButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.uploadStepButton.click();
  }

  async uploadEvidence(filePath: string) {
    await this.uploadInput.setInputFiles(filePath);
    // Wait for the preview/upload handling to complete so the submit button becomes enabled
    await expect(this.submitButton).toBeEnabled({ timeout: 5000 });
  }
}
