import { expect, test } from '@playwright/test';

test('plays a round, dies, and restarts', async ({ page }) => {
  await page.goto('/');
  const root = page.getByTestId('game-root');

  await expect(root).toHaveAttribute('data-status', 'menu', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(root).toHaveAttribute('data-status', 'ready');

  await page.keyboard.press('Space');
  await expect(root).toHaveAttribute('data-status', /playing|dying|gameover/);
  await page.keyboard.press('Space');

  await expect(root).toHaveAttribute('data-status', 'gameover', { timeout: 10_000 });
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(root).toHaveAttribute('data-status', 'ready');
});
