// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to home page and log in
    await page.goto('/');
    
    // Since we have a mock user in the backend, we can simply navigate to dashboard
    // In a real test, we would perform login steps here
    await page.goto('/dashboard');
    
    // Wait for the dashboard to load
    await page.waitForSelector('text=Portfolio Dashboard');
  });

  test('should display dashboard with portfolio balance', async ({ page }) => {
    // Verify that the dashboard header is visible
    await expect(page.locator('text=Portfolio Dashboard')).toBeVisible();
    
    // Check if the portfolio balance section is visible
    await expect(page.locator('text=Portfolio Balance')).toBeVisible();
    
    // Verify that performance metrics are shown
    await expect(page.locator('text=24h Change')).toBeVisible();
    await expect(page.locator('text=7d Change')).toBeVisible();
  });

  test('should allow switching between tabs', async ({ page }) => {
    // Initially on Allocation tab (default)
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Allocation');
    
    // Click on the Vaults tab
    await page.click('button[role="tab"]:has-text("Vaults")');
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Vaults');
    
    // Verify vaults tab content is visible
    const vaultsContent = page.locator('[role="tabpanel"]:visible');
    await expect(vaultsContent).toBeVisible();
    
    // Click on the Portfolio tab
    await page.click('button[role="tab"]:has-text("Overview")');
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Overview');
    
    // Verify portfolio chart is visible in this tab
    await expect(page.locator('text=Portfolio Allocation')).toBeVisible();
    
    // Click on the Settings tab
    await page.click('button[role="tab"]:has-text("Settings")');
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Settings');
    
    // Verify settings content
    await expect(page.locator('text=Portfolio Settings')).toBeVisible();
  });

  test('should navigate to contract test page', async ({ page }) => {
    // Click on Contract Testing button
    await page.click('button:has-text("Contract Testing")');
    
    // Verify navigation to contract test page
    await expect(page).toHaveURL(/.*\/contract-test/);
    await expect(page.locator('text=L1X Contract Testing')).toBeVisible();
  });

  test('should navigate to create vault page', async ({ page }) => {
    // Click on Create Vault button
    await page.click('button:has-text("Create Vault")');
    
    // Verify navigation to create vault page
    await expect(page).toHaveURL(/.*\/vaults\/new/);
  });

  test('should have responsive design', async ({ page }) => {
    // Desktop view (default)
    await expect(page.locator('text=Portfolio Dashboard')).toBeVisible();
    
    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=Portfolio Dashboard')).toBeVisible();
    
    // Check that tabs are still visible
    await expect(page.locator('button[role="tab"]:has-text("Allocation")')).toBeVisible();
    
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=Portfolio Dashboard')).toBeVisible();
    
    // Check that tabs adapt to mobile view
    await expect(page.locator('button[role="tab"]')).toBeVisible();
  });
});

test.describe('Contract Test Page', () => {
  test('should allow contract deployment and testing', async ({ page }) => {
    // Navigate to contract test page
    await page.goto('/contract-test');
    
    // Verify the page loaded
    await expect(page.locator('text=L1X Contract Testing')).toBeVisible();
    
    // Check if both tabs are present
    await expect(page.locator('button[role="tab"]:has-text("Deploy Contract")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Test Contract")')).toBeVisible();
    
    // Verify deploy tab is active by default
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Deploy Contract');
    
    // Check for file upload control
    await expect(page.locator('text=Contract WASM File')).toBeVisible();
    
    // Switch to test tab
    await page.click('button[role="tab"]:has-text("Test Contract")');
    await expect(page.locator('button[role="tab"][data-state="active"]')).toContainText('Test Contract');
    
    // Verify contract tester is visible
    await expect(page.locator('text=L1X Contract Tester')).toBeVisible();
    await expect(page.locator('text=Wallet Connection')).toBeVisible();
    await expect(page.locator('text=Contract Connection')).toBeVisible();
  });
});