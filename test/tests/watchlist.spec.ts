import { test, expect } from '@playwright/test';

test.describe('Watchlist', () => {
  test('watchlist panel has exactly 10 tickers', async ({ page }) => {
    await page.goto('/');
    const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });

    // Wait for watchlist to load from API
    await expect(watchlist.getByText('AAPL', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Each row contains a bold monospace ticker; count them
    const rows = watchlist.locator('.font-mono.font-bold');
    await expect(rows).toHaveCount(10, { timeout: 10_000 });
  });

  test('clicking a watchlist ticker updates the chart area label', async ({ page }) => {
    await page.goto('/');
    const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });
    await expect(watchlist.getByText('AAPL', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Click GOOGL in the watchlist
    await watchlist.getByText('GOOGL', { exact: true }).first().click();

    // Main chart label should update to show the selected ticker
    await expect(page.getByText('GOOGL — Price')).toBeVisible({ timeout: 5_000 });
  });

  test('default selected ticker matches chart label', async ({ page }) => {
    await page.goto('/');

    // First ticker (AAPL) is selected by default
    await expect(page.getByText('AAPL — Price')).toBeVisible({ timeout: 10_000 });
  });

  test('watchlist shows sparklines alongside prices', async ({ page }) => {
    await page.goto('/');
    // Wait for SSE to start feeding sparklines
    await expect(page.getByText('Live')).toBeVisible({ timeout: 5_000 });

    const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });
    // SVG sparklines are rendered once data arrives
    await expect(watchlist.locator('svg').first()).toBeVisible({ timeout: 10_000 });
  });
});
