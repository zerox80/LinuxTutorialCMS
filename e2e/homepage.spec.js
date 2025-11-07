import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check if title is visible
    await expect(page.locator('h1')).toBeVisible();
    
    // Check if navigation is present
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');
    
    // Find and click theme toggle
    const themeToggle = page.getByRole('button', { name: /theme/i });
    await themeToggle.click();
    
    // Check if dark class is applied
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('should open search modal', async ({ page }) => {
    await page.goto('/');
    
    // Click search button
    const searchBtn = page.getByRole('button', { name: /search/i });
    await searchBtn.click();
    
    // Check if search modal appears
    await expect(page.getByPlaceholder(/suchen/i)).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check mobile menu button
    const menuButton = page.getByRole('button', { name: /menu/i }).first();
    await expect(menuButton).toBeVisible();
  });
});
