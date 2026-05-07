import { test, expect } from '@playwright/test';

// The deterministic response returned by LLM_MOCK=true
const MOCK_RESPONSE =
  "I'm FinAlly, your AI trading assistant. I can analyze your portfolio, " +
  'suggest trades, and execute orders. What would you like to do?';

test.describe('AI Chat', () => {
  test('chat panel is visible with placeholder text', async ({ page }) => {
    await page.goto('/');
    const chatPanel = page.locator('aside').filter({ hasText: 'AI Assistant' });
    await expect(chatPanel).toBeVisible({ timeout: 10_000 });
    await expect(chatPanel.getByText('Ask me anything about your portfolio')).toBeVisible();
  });

  test('send a message and receive mock AI response', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Message FinAlly…').fill('Hello FinAlly');
    await page.getByRole('button', { name: 'Send' }).click();

    // User message bubble must appear immediately
    const chatPanel = page.locator('aside').filter({ hasText: 'AI Assistant' });
    await expect(chatPanel.getByText('Hello FinAlly')).toBeVisible({ timeout: 5_000 });

    // Mock response must appear within 10 seconds
    await expect(chatPanel.getByText(MOCK_RESPONSE)).toBeVisible({ timeout: 10_000 });
  });

  test('loading indicator appears while waiting for response', async ({ page }) => {
    await page.goto('/');

    // Slow down the chat response so we can observe the loading state
    await page.route('/api/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.getByPlaceholder('Message FinAlly…').fill('Test loading');
    await page.getByRole('button', { name: 'Send' }).click();

    // Three bouncing dots appear while the request is in-flight
    const chatPanel = page.locator('aside').filter({ hasText: 'AI Assistant' });
    await expect(chatPanel.locator('.animate-bounce').first()).toBeVisible({ timeout: 5_000 });

    // Response eventually arrives and dots disappear
    await expect(chatPanel.getByText(MOCK_RESPONSE)).toBeVisible({ timeout: 15_000 });
  });

  test('send button is disabled during loading and re-enables after typing', async ({ page }) => {
    await page.goto('/');

    await page.route('/api/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });

    const input = page.getByPlaceholder('Message FinAlly…');
    await input.fill('Disable check');
    const sendButton = page.getByRole('button', { name: 'Send' });
    await sendButton.click();

    // Button must be disabled during the in-flight request (loading=true)
    await expect(sendButton).toBeDisabled({ timeout: 3_000 });

    // After response arrives, input is cleared so button stays disabled (correct UX)
    const chatPanel = page.locator('aside').filter({ hasText: 'AI Assistant' });
    await expect(chatPanel.getByText(MOCK_RESPONSE)).toBeVisible({ timeout: 15_000 });

    // Typing new text re-enables the button
    await input.fill('new message');
    await expect(sendButton).toBeEnabled({ timeout: 3_000 });
  });

  test('AI Chat toggle hides and shows the chat panel', async ({ page }) => {
    await page.goto('/');
    const chatPanel = page.locator('aside').filter({ hasText: 'AI Assistant' });
    await expect(chatPanel).toBeVisible({ timeout: 5_000 });

    // Click toggle to close
    await page.getByRole('button', { name: 'AI Chat' }).click();
    await expect(chatPanel).not.toBeVisible({ timeout: 3_000 });

    // Click toggle to re-open
    await page.getByRole('button', { name: 'AI Chat' }).click();
    await expect(chatPanel).toBeVisible({ timeout: 3_000 });
  });
});
