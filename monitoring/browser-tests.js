const playwright = require('playwright');
const fs = require('fs');

class BrowserMonitor {
  constructor() {
    this.browsers = {};
    this.errorCallbacks = [];
    this.setupContinuousMonitoring();
  }

  async setupContinuousMonitoring() {
    try {
      // Launch browsers for monitoring
      for (const browserType of ['chromium', 'firefox', 'webkit']) {
        const browser = await playwright[browserType].launch({ 
          headless: false, // So you can see what's happening
          slowMo: 100 
        });
        this.browsers[browserType] = browser;
      }

      // Start continuous testing
      this.startContinuousTests();
    } catch (error) {
      console.log('Browser setup error:', error.message);
      // Fallback to headless mode if display issues
      this.setupHeadlessBrowsers();
    }
  }

  async setupHeadlessBrowsers() {
    try {
      for (const browserType of ['chromium']) { // Start with just chromium
        const browser = await playwright[browserType].launch({ 
          headless: true
        });
        this.browsers[browserType] = browser;
      }
      this.startContinuousTests();
    } catch (error) {
      console.log('Headless browser setup failed:', error.message);
    }
  }

  async startContinuousTests() {
    setInterval(async () => {
      await this.runTestSuite();
    }, 30000); // Test every 30 seconds
  }

  async runTestSuite() {
    if (!fs.existsSync('./.claude/browser-config.json')) {
      console.log('Browser config not found, skipping tests');
      return;
    }

    const config = JSON.parse(fs.readFileSync('./.claude/browser-config.json'));
    
    for (const scenario of config.browser_testing.test_scenarios) {
      for (const [browserType, browser] of Object.entries(this.browsers)) {
        await this.runScenario(browser, browserType, scenario);
      }
    }
  }

  async runScenario(browser, browserType, scenario) {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.notifyError({
          source: 'browser',
          browser: browserType,
          type: 'console_error',
          message: msg.text(),
          url: page.url(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      this.notifyError({
        source: 'browser',
        browser: browserType,
        type: 'page_error',
        message: error.message,
        stack: error.stack,
        url: page.url(),
        timestamp: new Date().toISOString()
      });
    });

    // Capture network errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        this.notifyError({
          source: 'browser',
          browser: browserType,
          type: 'network_error',
          message: `${response.status()} ${response.statusText()}`,
          url: response.url(),
          timestamp: new Date().toISOString()
        });
      }
    });

    try {
      // Navigate to scenario URL with timeout
      await page.goto(scenario.url, { timeout: 10000 });
      
      // Execute scenario actions
      for (const action of scenario.actions) {
        await this.executeAction(page, action);
      }

      // Run assertions
      for (const assertion of scenario.assertions) {
        await this.runAssertion(page, assertion);
      }

      // Take screenshot for success
      const screenshotDir = './logs/browser';
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      await page.screenshot({ 
        path: `${screenshotDir}/success-${browserType}-${scenario.name}-${Date.now()}.png` 
      });

    } catch (error) {
      // Take screenshot on error
      const screenshotDir = './logs/browser';
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      await page.screenshot({ 
        path: `${screenshotDir}/error-${browserType}-${scenario.name}-${Date.now()}.png` 
      });

      this.notifyError({
        source: 'browser',
        browser: browserType,
        type: 'scenario_failure',
        scenario: scenario.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }

    await context.close();
  }

  async executeAction(page, action) {
    // Placeholder for action execution
    // In a real implementation, this would handle different action types
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async runAssertion(page, assertion) {
    // Placeholder for assertion checking
    // In a real implementation, this would verify different assertions
    return true;
  }

  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  notifyError(error) {
    this.errorCallbacks.forEach(callback => callback(error));
  }
}

module.exports = new BrowserMonitor();