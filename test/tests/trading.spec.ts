import { test, expect, type Page } from '@playwright/test';

/** Wait for the SSE stream to connect and live prices to populate the watchlist. */
async function waitForLivePrices(page: Page) {
  await expect(page.getByText('Live')).toBeVisible({ timeout: 15_000 });
  const watchlist = page.locator('aside').filter({ hasText: 'Watchlist' });
  await expect(
    watchlist.locator('span').filter({ hasText: /^\$\d/ }).first(),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Read the current cash balance from the header.
 * The Cash value uses the class combination text-text-primary + font-mono,
 * distinct from Total Value (text-accent-yellow + font-mono).
 * Waits for the portfolio API to return before reading.
 */
async function getCashValue(page: Page): Promise<number> {
  const cashEl = page.locator('header .text-text-primary.font-mono');
  await expect(cashEl).toContainText('$', { timeout: 10_000 });
  const text = await cashEl.innerText();
  return parseFloat(text.replace(/[$,]/g, ''));
}

// Run trading tests serially so DB state is predictable across tests.
test.describe('Trading', () => {
  test.describe.configure({ mode: 'serial' });

  test('buy 10 AAPL decreases cash and creates a position', async ({ page }) => {
    await page.goto('/');
    await waitForLivePrices(page);

    const cashBefore = await getCashValue(page);
    expect(cashBefore).toBeGreaterThan(0);

    await page.getByPlaceholder('Ticker').fill('AAPL');
    await page.getByPlaceholder('Quantity').fill('10');
    await page.getByRole('button', { name: 'Buy' }).click();

    // Cash must decrease after the buy
    await expect
      .poll(async () => (await getCashValue(page)) < cashBefore, { timeout: 10_000 })
      .toBeTruthy();

    // AAPL position row must appear in the Positions table (tds carry ticker symbol)
    await expect(page.locator('td').filter({ hasText: /^AAPL$/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('sell 5 AAPL increases cash and position remains', async ({ page }) => {
    // Depends on previous test leaving an AAPL position in the DB.
    await page.goto('/');
    await waitForLivePrices(page);

    // Verify AAPL position exists from the previous test
    await expect(page.locator('td').filter({ hasText: /^AAPL$/ })).toBeVisible({
      timeout: 10_000,
    });

    const cashBefore = await getCashValue(page);

    await page.getByPlaceholder('Ticker').fill('AAPL');
    await page.getByPlaceholder('Quantity').fill('5');
    await page.getByRole('button', { name: 'Sell' }).click();

    // Cash must increase after the sell
    await expect
      .poll(async () => (await getCashValue(page)) > cashBefore, { timeout: 10_000 })
      .toBeTruthy();

    // Position still exists (sold only 5 of 10)
    await expect(page.locator('td').filter({ hasText: /^AAPL$/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('trade with insufficient cash shows inline error', async ({ page }) => {
    await page.goto('/');
    await waitForLivePrices(page);

    await page.getByPlaceholder('Ticker').fill('AAPL');
    await page.getByPlaceholder('Quantity').fill('999999');
    await page.getByRole('button', { name: 'Buy' }).click();

    // TradeBar renders error text with the .text-down class
    await expect(
      page.locator('.text-down').filter({ hasText: /Insufficient|cash/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
