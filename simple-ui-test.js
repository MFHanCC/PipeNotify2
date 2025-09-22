const { chromium } = require('playwright');

async function simpleUITest() {
  console.log('🚀 Starting simple UI test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to dashboard
    console.log('📱 Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(3000);
    
    // Check current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // If on onboarding, click Skip Setup
    if (currentUrl.includes('onboarding')) {
      console.log('⏭️ On onboarding page, looking for Skip Setup...');
      try {
        await page.click('text=Skip Setup', { timeout: 5000 });
        console.log('✅ Clicked Skip Setup');
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log('❌ Could not click Skip Setup:', e.message);
      }
    }
    
    // Check what we have now
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // Look for dashboard elements
    console.log('🔍 Looking for dashboard elements...');
    
    // Check for sidebar navigation
    const sidebarExists = await page.locator('.dashboard-sidebar, .sidebar-nav').isVisible().catch(() => false);
    console.log('Sidebar visible:', sidebarExists);
    
    // Look for navigation tabs/buttons
    const navButtons = await page.locator('button, .nav-tab, [role="button"]').count().catch(() => 0);
    console.log('Navigation buttons found:', navButtons);
    
    // Look specifically for Rules-related elements
    const rulesElements = await page.locator('text=/rules/i, text=/Rules/').count().catch(() => 0);
    console.log('Rules-related elements found:', rulesElements);
    
    if (rulesElements > 0) {
      // Try to click on rules
      console.log('📋 Attempting to click on Rules...');
      try {
        await page.click('text=/rules/i', { timeout: 5000 });
        console.log('✅ Clicked on Rules');
        await page.waitForTimeout(2000);
        
        // Now test the specific issues
        await testBulkOperations(page);
        await testEditForm(page);
        
      } catch (e) {
        console.log('❌ Could not click Rules:', e.message);
      }
    } else {
      console.log('❌ No Rules elements found');
      
      // List what navigation options we do have
      console.log('Available navigation items:');
      const buttons = await page.locator('button, .nav-tab').all();
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        try {
          const text = await buttons[i].textContent();
          if (text && text.trim()) {
            console.log(`  - "${text.trim()}"`);
          }
        } catch (e) {
          // Skip this button
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    await browser.close();
  }
}

async function testBulkOperations(page) {
  console.log('\n⚡ Testing Bulk Operations...');
  
  // Look for bulk operation buttons
  const bulkButtons = await page.locator('button:has-text("Activate"), button:has-text("Deactivate")').count();
  console.log('Bulk operation buttons found:', bulkButtons);
  
  if (bulkButtons > 0) {
    console.log('✅ Bulk operation buttons are present');
    
    // Try to click one if there are any rules
    const ruleCheckboxes = await page.locator('input[type="checkbox"]').count();
    console.log('Rule checkboxes found:', ruleCheckboxes);
    
    if (ruleCheckboxes > 0) {
      console.log('🧪 Testing bulk operation...');
      try {
        // Select first checkbox
        await page.click('input[type="checkbox"]', { timeout: 3000 });
        console.log('✅ Selected a rule');
        
        // Try to activate
        await page.click('button:has-text("Activate")', { timeout: 3000 });
        console.log('✅ Clicked Activate button');
        
        // Wait and check for any error messages
        await page.waitForTimeout(1000);
        const errorVisible = await page.locator('text=/error/i, text=/failed/i').isVisible().catch(() => false);
        console.log('Error message visible:', errorVisible);
        
        if (!errorVisible) {
          console.log('✅ No error message - bulk operation seems to work!');
        } else {
          console.log('❌ Error message detected - bulk operation failed');
        }
        
      } catch (e) {
        console.log('❌ Error testing bulk operations:', e.message);
      }
    }
  } else {
    console.log('❌ No bulk operation buttons found');
  }
}

async function testEditForm(page) {
  console.log('\n✏️ Testing Edit Form...');
  
  // Look for edit buttons
  const editButtons = await page.locator('button:has-text("Edit")').count();
  console.log('Edit buttons found:', editButtons);
  
  if (editButtons > 0) {
    console.log('🧪 Testing edit form visibility...');
    try {
      // Click first edit button
      await page.click('button:has-text("Edit")', { timeout: 3000 });
      console.log('✅ Clicked Edit button');
      await page.waitForTimeout(1000);
      
      // Check if edit form is visible
      const editFormVisible = await page.locator('.edit-form, form').isVisible().catch(() => false);
      console.log('Edit form visible:', editFormVisible);
      
      // Check if rule content is still visible
      const ruleHeaderVisible = await page.locator('.rule-header, .rule-info h4').isVisible().catch(() => false);
      console.log('Rule header still visible:', ruleHeaderVisible);
      
      if (editFormVisible && ruleHeaderVisible) {
        console.log('✅ Edit form works properly - both form and rule content visible');
      } else if (editFormVisible && !ruleHeaderVisible) {
        console.log('⚠️ Edit form visible but rule content hidden - overlay issue exists');
      } else if (!editFormVisible) {
        console.log('❌ Edit form not visible - edit functionality broken');
      }
      
    } catch (e) {
      console.log('❌ Error testing edit form:', e.message);
    }
  } else {
    console.log('❌ No edit buttons found');
  }
}

// Run the test
simpleUITest().catch(console.error);