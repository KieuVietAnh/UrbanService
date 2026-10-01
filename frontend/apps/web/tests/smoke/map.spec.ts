import { expect, test } from '@playwright/test';
import { MapPage } from '../pages/MapPage';

test.describe('Public map smoke tests', () => {
  test('Community map page loads without backend stubbing', async ({ page }) => {
    await page.goto('/community/map');
    const mapPage = new MapPage(page);

    await expect(page.getByRole('heading', { name: /Bản đồ sự cố đô thị/i })).toBeVisible();
    await expect(mapPage.mapContainer).toBeVisible();
  });
});
