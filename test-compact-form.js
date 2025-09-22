const { chromium } = require('playwright');

async function testCompactEditForm() {
  console.log('🎨 Testing compact edit form improvements...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to localhost...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    console.log('📍 Current URL:', page.url());
    
    // Check if we need authentication to access dashboard
    if (page.url().includes('onboarding')) {
      console.log('⚠️ Onboarding page detected. Need authentication to access dashboard Rules section.');
      console.log('');
      console.log('🔑 Do you have authentication credentials or a way to bypass to dashboard?');
      console.log('   Options:');
      console.log('   1. Provide real auth tokens');
      console.log('   2. Skip setup if possible');
      console.log('   3. Direct access method');
      console.log('');
      
      // Try to click Skip Setup if available
      const skipButton = await page.locator('text=Skip Setup').first();
      if (await skipButton.isVisible()) {
        console.log('⏭️ Attempting to click Skip Setup...');
        await skipButton.click();
        await page.waitForTimeout(3000);
        
        const newUrl = page.url();
        console.log('📍 New URL after skip:', newUrl);
        
        if (newUrl.includes('dashboard')) {
          console.log('✅ Successfully reached dashboard!');
          await testEditFormOnDashboard(page);
        } else {
          console.log('❌ Still not on dashboard. Need proper authentication.');
          await analyzeOnboardingPage(page);
        }
      } else {
        console.log('❌ Skip Setup button not found.');
        await analyzeOnboardingPage(page);
      }
    } else if (page.url().includes('dashboard')) {
      console.log('✅ Already on dashboard!');
      await testEditFormOnDashboard(page);
    } else {
      console.log('🤔 Unexpected page. Let me analyze...');
      await analyzeCurrentPage(page);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    console.log('');
    console.log('🔍 Keeping browser open for manual inspection...');
    console.log('   Close browser manually when done reviewing');
    // Don't close browser automatically so you can inspect
    // await browser.close();
  }
}

async function testEditFormOnDashboard(page) {
  console.log('\n📋 Testing Rules section and edit form...');
  
  // Look for Rules navigation
  const rulesSelectors = [
    'text=Rules',
    'text=rules', 
    '.nav-tab:has-text("Rules")',
    'button:has-text("Rules")',
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
    console.log('❌ Could not find Rules navigation. Available navigation:');
    const navItems = await page.locator('button, .nav-tab, [role="button"]').all();
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
  
  await page.waitForTimeout(1000);
  
  // Look for existing rules with Edit buttons
  console.log('\n🔍 Looking for rules with Edit buttons...');
  const editButtons = await page.locator('button:has-text("Edit")').count();
  console.log(`Edit buttons found: ${editButtons}`);
  
  if (editButtons > 0) {
    console.log('\n🧪 Testing edit form compact improvements...');
    
    // Take screenshot before editing
    await page.screenshot({ path: 'before-edit.png' });
    console.log('📸 Screenshot saved: before-edit.png');
    
    // Click first edit button
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(1000);
    
    // Take screenshot with edit form open
    await page.screenshot({ path: 'edit-form-open.png' });
    console.log('📸 Screenshot saved: edit-form-open.png');
    
    // Analyze edit form
    const editForm = page.locator('.edit-form').first();
    const isEditFormVisible = await editForm.isVisible().catch(() => false);
    console.log('Edit form visible:', isEditFormVisible);
    
    if (isEditFormVisible) {
      // Get edit form dimensions
      const formBox = await editForm.boundingBox();
      if (formBox) {
        console.log(`Edit form dimensions: ${formBox.width}x${formBox.height}px`);
      }
      
      // Check padding and spacing improvements
      const formStyles = await editForm.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          padding: styles.padding,
          gap: styles.gap,
          borderRadius: styles.borderRadius
        };
      });
      console.log('Edit form styles:', formStyles);
      
      // Test mobile view
      console.log('\n📱 Testing mobile view...');
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      
      // Take mobile screenshot
      await page.screenshot({ path: 'edit-form-mobile.png' });
      console.log('📸 Mobile screenshot saved: edit-form-mobile.png');
      
      const mobileFormBox = await editForm.boundingBox();
      if (mobileFormBox) {
        console.log(`Mobile edit form dimensions: ${mobileFormBox.width}x${mobileFormBox.height}px`);
      }
      
      // Check if form inputs are properly sized
      const inputs = await page.locator('.edit-form input, .edit-form select').count();
      console.log(`Form inputs found: ${inputs}`);
      
      if (inputs > 0) {
        const firstInput = page.locator('.edit-form input, .edit-form select').first();
        const inputBox = await firstInput.boundingBox();
        if (inputBox) {
          console.log(`First input dimensions: ${inputBox.width}x${inputBox.height}px`);
          
          if (inputBox.height <= 32) {
            console.log('✅ Input height is compact (≤32px)');
          } else {
            console.log('⚠️ Input height could be more compact');
          }
        }
      }
      
      console.log('\n📊 ANALYSIS COMPLETE');
      console.log('✅ Screenshots saved for manual review:');
      console.log('  - before-edit.png');
      console.log('  - edit-form-open.png'); 
      console.log('  - edit-form-mobile.png');
      
    } else {
      console.log('❌ Edit form not visible after clicking Edit button');
    }
    
  } else {
    console.log('❌ No Edit buttons found. Need existing rules to test edit form.');
    console.log('💡 Try creating a rule first, then test the edit form.');
  }
}

async function analyzeOnboardingPage(page) {
  console.log('\n🔍 Analyzing onboarding page...');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const buttons = await page.locator('button').all();
  console.log('Available buttons:');
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    try {
      const text = await buttons[i].textContent();
      if (text && text.trim()) {
        console.log(`  - "${text.trim()}"`);
      }
    } catch (e) {
      // Skip
    }
  }
}

async function analyzeCurrentPage(page) {
  console.log('\n🔍 Analyzing current page...');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const bodyText = await page.locator('body').textContent();
  const snippet = bodyText.substring(0, 200) + '...';
  console.log('Page content snippet:', snippet);
}

// Run the test
testCompactEditForm().catch(console.error);