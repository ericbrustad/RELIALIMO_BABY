import { test, expect } from '@playwright/test';

test.describe('Example Test Suite', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://example.com');
    });

    test('should display the correct title', async ({ page }) => {
        await expect(page).toHaveTitle('Example Domain');
    });

    test('should have a visible heading', async ({ page }) => {
        const heading = page.locator('h1');
        await expect(heading).toBeVisible();
    });
});