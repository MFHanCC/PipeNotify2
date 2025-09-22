const { chromium } = require('playwright');

async function testWithManualLogin() {
  console.log('🌐 Opening browser for manual login...');
  console.log('📋 Steps:');
  console.log('1. Browser will open to localhost:3000');
  console.log('2. Please login manually through the interface');
  console.log('3. Navigate to Rules section');
  console.log('4. I\'ll then test the compact edit form design');
  console.log('');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for easier manual interaction
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    console.log('🌐 Opening localhost:3000...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    console.log('');
    console.log('🔑 Please login manually in the browser window...');
    console.log('⏳ I\'ll wait for you to reach the Rules section');
    console.log('');
    
    // Wait for user to navigate to dashboard/rules
    await waitForRulesSection(page);
    
    // Now test the edit form
    await testCompactEditForm(page);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('');
  console.log('🔍 Browser will stay open for inspection');
  console.log('Close manually when done');
  // Don't close automatically
}

async function waitForRulesSection(page) {
  console.log('⏳ Waiting for Rules section...');
  
  let attempts = 0;
  const maxAttempts = 60; // Wait up to 5 minutes
  
  while (attempts < maxAttempts) {
    try {
      // Check if we're on dashboard and can see Rules
      const url = page.url();
      console.log(`Check ${attempts + 1}: Current URL - ${url}`);
      
      // Look for Rules navigation or section
      const rulesVisible = await page.locator('text=Rules, button:has-text("Rules"), .nav-tab:has-text("Rules")').isVisible().catch(() => false);
      
      if (rulesVisible || url.includes('dashboard')) {
        console.log('✅ Found dashboard/rules section!');
        
        // Try to click Rules if it's a navigation item
        try {
          const rulesNav = page.locator('text=Rules, button:has-text("Rules"), .nav-tab:has-text("Rules")').first();
          if (await rulesNav.isVisible()) {
            await rulesNav.click();
            console.log('📋 Clicked on Rules navigation');
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          console.log('Already on rules section or no navigation needed');
        }
        
        return;
      }
      
      await page.waitForTimeout(5000); // Wait 5 seconds between checks
      attempts++;
      
    } catch (e) {
      console.log(`Check ${attempts + 1}: Still waiting...`);
      await page.waitForTimeout(5000);
      attempts++;
    }
  }
  
  console.log('⚠️ Timeout waiting for Rules section. Proceeding anyway...');
}

async function testCompactEditForm(page) {
  console.log('\n🧪 Testing Compact Edit Form Design...');
  
  // Look for edit buttons
  const editButtons = await page.locator('button:has-text("Edit")').count();
  console.log(`📝 Edit buttons found: ${editButtons}`);
  
  if (editButtons === 0) {
    console.log('❌ No edit buttons found. Make sure you\'re on the Rules section with existing rules.');
    return;
  }
  
  // Take screenshot before editing
  console.log('📸 Taking before screenshot...');
  await page.screenshot({ path: 'before-compact-edit.png', fullPage: true });
  
  // Click first edit button
  console.log('✏️ Clicking Edit button...');
  await page.click('button:has-text("Edit")');
  await page.waitForTimeout(1000);
  
  // Take screenshot with edit form open
  console.log('📸 Taking edit form screenshot...');
  await page.screenshot({ path: 'compact-edit-form.png', fullPage: true });
  
  // Analyze the edit form
  const editForm = page.locator('.edit-form').first();
  const isVisible = await editForm.isVisible().catch(() => false);
  
  if (isVisible) {
    console.log('✅ Edit form is visible!');
    
    // Get form dimensions
    const formBox = await editForm.boundingBox();
    if (formBox) {
      console.log(`📐 Edit form dimensions: ${Math.round(formBox.width)}x${Math.round(formBox.height)}px`);
    }
    
    // Check for compact layout features
    const formRows = await page.locator('.form-row').count();
    console.log(`📋 Form rows found: ${formRows}`);
    
    // Check if rule content is still visible
    const ruleHeaderVisible = await page.locator('.rule-header').first().isVisible().catch(() => false);
    console.log(`👁️ Rule content still visible: ${ruleHeaderVisible}`);
    
    // Test mobile view
    console.log('\n📱 Testing mobile view...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'compact-edit-mobile.png', fullPage: true });
    console.log('📸 Mobile screenshot taken');
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    
    console.log('\n📊 RESULTS:');
    console.log('✅ Compact edit form tested successfully!');
    console.log('📸 Screenshots saved:');
    console.log('  - before-compact-edit.png');
    console.log('  - compact-edit-form.png');
    console.log('  - compact-edit-mobile.png');
    
  } else {
    console.log('❌ Edit form not visible after clicking Edit');
  }
}

// Run the test
testWithManualLogin().catch(console.error);