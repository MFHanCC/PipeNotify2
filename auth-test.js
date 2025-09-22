const { chromium } = require('playwright');

async function testWithAuth() {
  console.log('🚀 Starting authenticated UI test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Set a fake auth token in localStorage to bypass authentication
    console.log('🔐 Setting fake auth token...');
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.setItem('pipedrive_token', 'fake-token-for-testing');
      localStorage.setItem('user_data', JSON.stringify({
        id: 1,
        name: 'Test User',
        company_id: 123
      }));
    });
    
    // Now navigate to dashboard
    console.log('📱 Navigating to dashboard with auth...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // If still on onboarding, try to skip with auth
    if (currentUrl.includes('onboarding')) {
      console.log('⏭️ Still on onboarding, trying to skip with auth...');
      
      // Listen for alerts
      page.on('dialog', async dialog => {
        console.log('Alert detected:', dialog.message());
        await dialog.accept();
      });
      
      try {
        await page.click('text=Skip Setup', { timeout: 5000 });
        console.log('✅ Clicked Skip Setup with auth');
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log('❌ Skip Setup failed:', e.message);
      }
    }
    
    // Check if we're now on dashboard
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    if (finalUrl.includes('dashboard') && !finalUrl.includes('onboarding')) {
      console.log('✅ Successfully reached dashboard!');
      await testDashboardUIFixes(page);
    } else {
      console.log('❌ Still not on dashboard. Checking what we have...');
      await analyzeCurrentPage(page);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    await browser.close();
  }
}

async function analyzeCurrentPage(page) {
  console.log('\n🔍 Analyzing current page...');
  
  // Get page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check for main content
  const bodyText = await page.locator('body').textContent();
  const snippet = bodyText.substring(0, 200) + '...';
  console.log('Page content snippet:', snippet);
  
  // Look for navigation elements
  const buttons = await page.locator('button').count();
  console.log('Buttons found:', buttons);
  
  // Look for specific dashboard elements
  const dashboardElements = await page.locator('.dashboard, .sidebar, .nav-tab').count();
  console.log('Dashboard elements found:', dashboardElements);
}

async function testDashboardUIFixes(page) {
  console.log('\n🧪 Testing Dashboard UI Fixes...');
  
  // Wait for dashboard to load
  await page.waitForTimeout(2000);
  
  // Look for sidebar navigation
  console.log('🔍 Looking for sidebar navigation...');
  const sidebarVisible = await page.locator('.dashboard-sidebar, .sidebar-nav').isVisible().catch(() => false);
  console.log('Sidebar visible:', sidebarVisible);
  
  // Look for Rules tab/button
  const rulesSelectors = [
    'text=Rules',
    'button:has-text("Rules")',
    '.nav-tab:has-text("Rules")',
    '[data-testid="rules-tab"]'
  ];
  
  let rulesFound = false;
  for (const selector of rulesSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        console.log(`✅ Found Rules navigation: ${selector}`);
        await element.click();
        await page.waitForTimeout(1000);
        rulesFound = true;
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!rulesFound) {
    console.log('❌ Could not find Rules navigation');
    // List available navigation
    const navItems = await page.locator('button, .nav-tab, [role="button"]').all();
    console.log('Available navigation items:');
    for (let i = 0; i < Math.min(navItems.length, 10); i++) {
      try {
        const text = await navItems[i].textContent();
        if (text && text.trim()) {
          console.log(`  - "${text.trim()}"`);
        }
      } catch (e) {
        // Skip
      }
    }
    return;
  }
  
  // Now test the specific UI fixes
  await testBulkOperationsFix(page);
  await testEditFormFix(page);
  await testMobileResponsiveness(page);
}

async function testBulkOperationsFix(page) {
  console.log('\n⚡ TEST 1: Bulk Operations Fix');
  
  // Look for bulk operation area
  const bulkSection = await page.locator('.bulk-rule-manager, [data-testid="bulk-operations"]').isVisible().catch(() => false);
  console.log('Bulk operations section visible:', bulkSection);
  
  // Look for bulk buttons
  const activateBtn = await page.locator('button:has-text("Activate")').count();
  const deactivateBtn = await page.locator('button:has-text("Deactivate")').count();
  console.log('Activate buttons found:', activateBtn);
  console.log('Deactivate buttons found:', deactivateBtn);
  
  if (activateBtn > 0 || deactivateBtn > 0) {
    console.log('✅ Bulk operation buttons are present');
    
    // Check if there are rules to test with
    const ruleCards = await page.locator('.rule-card').count();
    console.log('Rule cards found:', ruleCards);
    
    if (ruleCards > 0) {
      console.log('🧪 Testing bulk operation (if possible)...');
      
      // Look for checkboxes
      const checkboxes = await page.locator('input[type="checkbox"]').count();
      console.log('Checkboxes found:', checkboxes);
      
      if (checkboxes > 0) {
        try {
          // Select first rule
          await page.click('input[type="checkbox"]', { timeout: 3000 });
          console.log('✅ Selected a rule');
          
          // Try to activate
          await page.click('button:has-text("Activate")', { timeout: 3000 });
          console.log('✅ Clicked Activate button');
          
          // Wait for response and check for errors
          await page.waitForTimeout(2000);
          
          // Look for error messages
          const errorMessages = await page.locator('text=/error/i, text=/failed/i, .error, .alert-error').count();
          console.log('Error messages found:', errorMessages);
          
          if (errorMessages === 0) {
            console.log('✅ BULK OPERATIONS FIX: SUCCESS - No error messages detected!');
          } else {
            console.log('❌ BULK OPERATIONS FIX: FAILED - Error messages still present');
          }
          
        } catch (e) {
          console.log('❌ Error testing bulk operations:', e.message);
        }
      }
    }
  } else {
    console.log('❌ No bulk operation buttons found');
  }
}

async function testEditFormFix(page) {
  console.log('\n✏️ TEST 2: Edit Form Visibility Fix');
  
  // Look for edit buttons
  const editButtons = await page.locator('button:has-text("Edit")').count();
  console.log('Edit buttons found:', editButtons);
  
  if (editButtons > 0) {
    console.log('🧪 Testing edit form overlay fix...');
    try {
      // Click first edit button
      await page.click('button:has-text("Edit")', { timeout: 3000 });
      console.log('✅ Clicked Edit button');
      await page.waitForTimeout(1000);
      
      // Check if edit form is visible
      const editFormVisible = await page.locator('.edit-form').isVisible().catch(() => false);
      console.log('Edit form visible:', editFormVisible);
      
      // Check if rule content is still visible (should be dimmed but visible)
      const ruleHeaderVisible = await page.locator('.rule-header, .rule-info h4').isVisible().catch(() => false);
      console.log('Rule header still visible:', ruleHeaderVisible);
      
      // Check for proper styling (background, etc.)
      const editFormHasBackground = await page.locator('.edit-form').evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent';
      }).catch(() => false);
      console.log('Edit form has background styling:', editFormHasBackground);
      
      if (editFormVisible && ruleHeaderVisible && editFormHasBackground) {
        console.log('✅ EDIT FORM FIX: SUCCESS - Form visible, rule content visible, proper styling!');
      } else if (editFormVisible && !ruleHeaderVisible) {
        console.log('⚠️ EDIT FORM FIX: PARTIAL - Form visible but rule content hidden');
      } else if (!editFormVisible) {
        console.log('❌ EDIT FORM FIX: FAILED - Edit form not visible');
      } else {
        console.log('⚠️ EDIT FORM FIX: PARTIAL - Missing proper styling');
      }
      
    } catch (e) {
      console.log('❌ Error testing edit form:', e.message);
    }
  } else {
    console.log('❌ No edit buttons found to test');
  }
}

async function testMobileResponsiveness(page) {
  console.log('\n📱 TEST 3: Mobile Responsiveness Fix');
  
  // Test mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  // Check if edit buttons are still visible and accessible
  const mobileEditButtons = await page.locator('button:has-text("Edit")').count();
  console.log('Mobile edit buttons visible:', mobileEditButtons);
  
  if (mobileEditButtons > 0) {
    // Check button dimensions for touch-friendliness
    const button = page.locator('button:has-text("Edit")').first();
    const buttonBox = await button.boundingBox().catch(() => null);
    
    if (buttonBox) {
      const isTouchFriendly = buttonBox.height >= 44; // iOS touch guidelines
      console.log(`Button dimensions: ${buttonBox.width}x${buttonBox.height}px`);
      console.log('Touch-friendly (≥44px height):', isTouchFriendly);
      
      if (isTouchFriendly) {
        console.log('✅ MOBILE RESPONSIVENESS FIX: SUCCESS - Buttons are touch-friendly!');
      } else {
        console.log('❌ MOBILE RESPONSIVENESS FIX: FAILED - Buttons too small for touch');
      }
    }
  } else {
    console.log('❌ MOBILE RESPONSIVENESS FIX: FAILED - Edit buttons not visible on mobile');
  }
  
  // Reset viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
}

// Run the test
testWithAuth().catch(console.error);