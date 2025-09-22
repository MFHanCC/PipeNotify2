const { chromium } = require('playwright');

async function testDashboardEditForm() {
  console.log('🧪 Testing compact edit form on dashboard...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Connect to the existing browser session
    console.log('🌐 Connecting to localhost:3000...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(3000);
    
    // Look for Rules section
    console.log('📋 Looking for Rules section...');
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
          console.log(`✅ Found Rules: ${selector}`);
          await element.click();
          await page.waitForTimeout(2000);
          rulesFound = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!rulesFound) {
      console.log('⚠️ Rules section not found, but proceeding...');
    }
    
    // Look for edit buttons
    console.log('🔍 Looking for Edit buttons...');
    const editButtons = await page.locator('button:has-text("Edit")').count();
    console.log(`Edit buttons found: ${editButtons}`);
    
    if (editButtons > 0) {
      // Take before screenshot
      console.log('📸 Taking before screenshot...');
      await page.screenshot({ path: 'dashboard-before-edit.png', fullPage: true });
      
      // Click edit button
      console.log('✏️ Clicking Edit button to test compact form...');
      await page.click('button:has-text("Edit")');
      await page.waitForTimeout(1500);
      
      // Take after screenshot
      console.log('📸 Taking compact edit form screenshot...');
      await page.screenshot({ path: 'compact-edit-form-test.png', fullPage: true });
      
      // Analyze the form
      await analyzeEditForm(page);
      
      // Test mobile
      await testMobileLayout(page);
      
    } else {
      console.log('❌ No edit buttons found. You may need to create a rule first.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n🔍 Browser staying open for inspection...');
  // Keep browser open
}

async function analyzeEditForm(page) {
  console.log('\n🔍 Analyzing compact edit form...');
  
  const editForm = page.locator('.edit-form').first();
  const isVisible = await editForm.isVisible().catch(() => false);
  
  if (isVisible) {
    console.log('✅ Edit form is visible');
    
    // Check dimensions
    const formBox = await editForm.boundingBox();
    if (formBox) {
      console.log(`📐 Form size: ${Math.round(formBox.width)}x${Math.round(formBox.height)}px`);
    }
    
    // Check for our new layout classes
    const formRows = await page.locator('.form-row').count();
    const formRowThirds = await page.locator('.form-row-thirds').count();
    const formRowAuto = await page.locator('.form-row-auto').count();
    
    console.log(`📋 Form rows: ${formRows}`);
    console.log(`📋 Form row thirds: ${formRowThirds}`);
    console.log(`📋 Form row auto: ${formRowAuto}`);
    
    // Check if rule content is visible
    const ruleVisible = await page.locator('.rule-header').first().isVisible().catch(() => false);
    console.log(`👁️ Rule content visible: ${ruleVisible}`);
    
    // Check form styling
    const formStyles = await editForm.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        background: styles.backgroundColor,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
        gap: styles.gap
      };
    });
    
    console.log('🎨 Form styling:', formStyles);
    
  } else {
    console.log('❌ Edit form not visible');
  }
}

async function testMobileLayout(page) {
  console.log('\n📱 Testing mobile layout...');
  
  // Switch to mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  // Take mobile screenshot
  await page.screenshot({ path: 'compact-edit-mobile-test.png', fullPage: true });
  console.log('📸 Mobile screenshot saved');
  
  // Check if form rows stack properly
  const formRows = await page.locator('.form-row').all();
  if (formRows.length > 0) {
    const firstRowStyles = await formRows[0].evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        gridTemplateColumns: styles.gridTemplateColumns,
        gap: styles.gap
      };
    });
    console.log('📱 Mobile form row styles:', firstRowStyles);
  }
  
  // Reset to desktop
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  console.log('\n📊 COMPACT EDIT FORM TEST COMPLETE!');
  console.log('📸 Screenshots saved:');
  console.log('  - dashboard-before-edit.png');
  console.log('  - compact-edit-form-test.png');
  console.log('  - compact-edit-mobile-test.png');
}

// Run the test
testDashboardEditForm().catch(console.error);