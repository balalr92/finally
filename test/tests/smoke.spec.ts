import { test, expect } from '@playwright/test';

const DEFAULT_TICKERS = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA',
  'NVDA', 'META', 'JPM', 'V', 'NFLX',
];

test.describe('Smoke', () => {
  test('page loads and shows FinAlly header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('FinAlly').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('AI Trading Workstation')).toBeVisible();
  });

  test('header shows $10,000 starting cash', async ({ page }) => {
    await page.goto('/');
    // The header has two values; Cash uses text-text-primary font-mono (Total Value uses text-accent-yellow)
    const cashValue = page.locator('header .text-text-primary.font-mono');
    await expect(cashValue).toContainText('$10,000.00', { timeout: 10_000 });
  });

  test('all 10 default tickers appear in the watchlist', async ({ page }) => {
    await page.goto('/');
    const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });
    for (const ticker of DEFAULT_TICKERS) {
      await expect(watchlist.getByText(ticker, { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('SSE stream connects and shows Live status within 5 seconds', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Live')).toBeVisible({ timeout: 5_000 });
  });

  test('prices start updating in the watchlist within 5 seconds', async ({ page }) => {
    await page.goto('/');
    // Wait for at least one price to appear (format: $123.45)
    const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });
    await expect(watchlist.locator('span').filter({ hasText: /^\$\d/ }).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
