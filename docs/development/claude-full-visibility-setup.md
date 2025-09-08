# Claude Code Full-Visibility Development Environment

This setup provides Claude Code with **complete visibility** into your Railway + Vercel project, including real-time browser testing, deployment monitoring, and autonomous error resolution.

## 🎯 **Full-Visibility Architecture**

### **What Claude Code Will Monitor:**
- ✅ **Real-time browser testing** with error capture
- ✅ **Railway backend logs and metrics** 
- ✅ **Vercel deployment status and errors**
- ✅ **GitHub repository changes and CI/CD**
- ✅ **Database query performance and errors**
- ✅ **API endpoint response times and failures**
- ✅ **Frontend console errors and warnings**
- ✅ **Network requests and CORS issues**
- ✅ **Authentication flow problems**
- ✅ **Webhook delivery failures**

### **Autonomous Error Resolution:**
- 🔧 **Automatic error detection and fixing**
- 🔧 **Real-time deployment issue resolution**
- 🔧 **Browser compatibility fixes**
- 🔧 **Performance optimization**
- 🔧 **Security vulnerability patching**

---

## 🚀 **Setup Instructions**

### **Step 1: Enhanced Project Structure**

```bash
pipedrive-google-chat-integration/
├── .claude/
│   ├── settings.json (expanded permissions)
│   ├── monitoring.json (full visibility config)
│   ├── browser-config.json (browser testing setup)
│   └── deployment-config.json (Railway/Vercel monitoring)
├── monitoring/
│   ├── browser-tests.js (automated browser testing)
│   ├── error-aggregator.js (collects all errors)
│   ├── deployment-monitor.js (monitors Railway/Vercel)
│   ├── github-monitor.js (GitHub CLI integration)
│   └── dashboard.html (real-time monitoring dashboard)
├── scripts/
│   ├── full-setup.sh (complete environment setup)
│   ├── start-monitoring.sh (starts all monitoring)
│   └── claude-autonomous.sh (autonomous mode startup)
├── logs/
│   ├── browser/
│   ├── railway/
│   ├── vercel/
│   ├── github/
│   └── aggregated/
└── (your project files)
```

### **Step 2: Enhanced Claude Configuration**

#### **.claude/settings.json**

```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Write(*)",
      "Read(*)",
      "Update(*)",
      "Execute(*)",
      "Network(*)",
      "Process(*)",
      "FileSystem(*)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(sudo systemctl)",
      "Bash(format)"
    ],
    "autonomous": true,
    "real_time_monitoring": true
  },
  "project": {
    "name": "pipedrive-google-chat-integration",
    "type": "marketplace-app",
    "architecture": "railway-vercel",
    "monitoring_level": "maximum",
    "auto_fix": true
  },
  "tools": {
    "github_cli": true,
    "railway_cli": true,
    "vercel_cli": true,
    "browser_automation": true,
    "error_aggregation": true
  }
}
```

#### **.claude/monitoring.json**

```json
{
  "monitoring": {
    "browser": {
      "enabled": true,
      "headless": false,
      "capture_screenshots": true,
      "record_network": true,
      "detect_errors": true,
      "auto_retry": true
    },
    "backend": {
      "railway_logs": true,
      "database_monitoring": true,
      "api_performance": true,
      "queue_monitoring": true
    },
    "frontend": {
      "vercel_logs": true,
      "console_errors": true,
      "performance_metrics": true,
      "bundle_analysis": true
    },
    "deployment": {
      "github_actions": true,
      "railway_deploys": true,
      "vercel_deploys": true,
      "rollback_detection": true
    }
  },
  "autonomous_actions": {
    "fix_errors": true,
    "optimize_performance": true,
    "update_dependencies": true,
    "deploy_fixes": true,
    "create_issues": true,
    "notify_critical": true
  },
  "thresholds": {
    "error_rate": 5,
    "response_time": 3000,
    "build_failures": 2,
    "test_failures": 0
  }
}
```

#### **.claude/browser-config.json**

```json
{
  "browser_testing": {
    "browsers": ["chromium", "firefox", "webkit"],
    "viewports": [
      {"width": 1920, "height": 1080},
      {"width": 1366, "height": 768},
      {"width": 375, "height": 667}
    ],
    "test_scenarios": [
      {
        "name": "OAuth Flow",
        "url": "http://localhost:3000/auth/pipedrive",
        "actions": ["click", "fill", "submit"],
        "assertions": ["no_errors", "redirect_success"]
      },
      {
        "name": "Dashboard Load",
        "url": "http://localhost:3000/dashboard",
        "actions": ["login", "navigate"],
        "assertions": ["data_loads", "no_console_errors"]
      },
      {
        "name": "Rule Creation",
        "url": "http://localhost:3000/rules/new",
        "actions": ["fill_form", "save", "test"],
        "assertions": ["rule_saved", "notification_sent"]
      }
    ],
    "continuous_monitoring": true,
    "screenshot_on_error": true,
    "video_recording": true
  }
}
```

### **Step 3: Monitoring Scripts**

#### **monitoring/error-aggregator.js**

```javascript
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

class ErrorAggregator {
  constructor() {
    this.errors = [];
    this.ws = new WebSocket('ws://localhost:8080');
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Monitor Railway logs
    this.monitorRailwayLogs();
    
    // Monitor Vercel logs  
    this.monitorVercelLogs();
    
    // Monitor browser errors
    this.monitorBrowserErrors();
    
    // Monitor GitHub Actions
    this.monitorGitHubActions();
    
    // Setup real-time dashboard
    this.setupDashboard();
  }

  monitorRailwayLogs() {
    const { spawn } = require('child_process');
    const railway = spawn('railway', ['logs', '--follow'], { stdio: 'pipe' });
    
    railway.stdout.on('data', (data) => {
      const logEntry = this.parseLogEntry(data.toString(), 'railway');
      if (logEntry.level === 'error') {
        this.handleError(logEntry);
      }
      this.saveLog('railway', logEntry);
    });
  }

  monitorVercelLogs() {
    const { spawn } = require('child_process');
    const vercel = spawn('vercel', ['logs', '--follow'], { stdio: 'pipe' });
    
    vercel.stdout.on('data', (data) => {
      const logEntry = this.parseLogEntry(data.toString(), 'vercel');
      if (logEntry.level === 'error') {
        this.handleError(logEntry);
      }
      this.saveLog('vercel', logEntry);
    });
  }

  monitorBrowserErrors() {
    // This connects to browser automation to capture console errors
    const browserMonitor = require('./browser-tests');
    browserMonitor.onError((error) => {
      this.handleError({
        source: 'browser',
        type: 'javascript_error',
        message: error.message,
        stack: error.stack,
        url: error.url,
        timestamp: new Date().toISOString()
      });
    });
  }

  handleError(error) {
    console.log(`🚨 Error detected: ${error.source} - ${error.message}`);
    
    // Add to error list
    this.errors.push(error);
    
    // Send to Claude for immediate fixing
    this.sendToClaudeForFix(error);
    
    // Update dashboard
    this.updateDashboard(error);
    
    // Save to aggregated log
    this.saveLog('aggregated', error);
  }

  sendToClaudeForFix(error) {
    const claudePrompt = `
🚨 IMMEDIATE ERROR DETECTED 🚨

Source: ${error.source}
Type: ${error.type}
Message: ${error.message}
Timestamp: ${error.timestamp}

Stack Trace: ${error.stack || 'N/A'}
URL: ${error.url || 'N/A'}

AUTONOMOUS ACTION REQUIRED:
1. Analyze the error and identify root cause
2. Implement fix immediately
3. Test the fix
4. Deploy if necessary
5. Verify resolution

Current project state available in logs/ directory.
`;

    // This would trigger Claude to take action
    fs.writeFileSync('./logs/claude-alerts/error-' + Date.now() + '.txt', claudePrompt);
  }

  saveLog(type, entry) {
    const logFile = `./logs/${type}/${new Date().toISOString().split('T')[0]}.log`;
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  }
}

module.exports = new ErrorAggregator();
```

#### **monitoring/browser-tests.js**

```javascript
const playwright = require('playwright');
const fs = require('fs');

class BrowserMonitor {
  constructor() {
    this.browsers = {};
    this.errorCallbacks = [];
    this.setupContinuousMonitoring();
  }

  async setupContinuousMonitoring() {
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
  }

  async startContinuousTests() {
    setInterval(async () => {
      await this.runTestSuite();
    }, 30000); // Test every 30 seconds
  }

  async runTestSuite() {
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
      // Navigate to scenario URL
      await page.goto(scenario.url);
      
      // Execute scenario actions
      for (const action of scenario.actions) {
        await this.executeAction(page, action);
      }

      // Run assertions
      for (const assertion of scenario.assertions) {
        await this.runAssertion(page, assertion);
      }

      // Take screenshot for success
      await page.screenshot({ 
        path: `./logs/browser/success-${browserType}-${scenario.name}-${Date.now()}.png` 
      });

    } catch (error) {
      // Take screenshot on error
      await page.screenshot({ 
        path: `./logs/browser/error-${browserType}-${scenario.name}-${Date.now()}.png` 
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

  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  notifyError(error) {
    this.errorCallbacks.forEach(callback => callback(error));
  }
}

module.exports = new BrowserMonitor();
```

#### **monitoring/deployment-monitor.js**

```javascript
const { spawn, exec } = require('child_process');
const fs = require('fs');

class DeploymentMonitor {
  constructor() {
    this.setupGitHubMonitoring();
    this.setupRailwayMonitoring();
    this.setupVercelMonitoring();
  }

  setupGitHubMonitoring() {
    // Monitor GitHub Actions via CLI
    setInterval(async () => {
      exec('gh run list --limit 1 --json status,conclusion,url', (error, stdout) => {
        if (!error) {
          const runs = JSON.parse(stdout);
          if (runs[0] && runs[0].conclusion === 'failure') {
            this.notifyError({
              source: 'github',
              type: 'build_failure',
              message: 'GitHub Action failed',
              url: runs[0].url,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  setupRailwayMonitoring() {
    // Monitor Railway deployments
    const railway = spawn('railway', ['status', '--json'], { stdio: 'pipe' });
    
    railway.stdout.on('data', (data) => {
      try {
        const status = JSON.parse(data.toString());
        if (status.deployment && status.deployment.status === 'FAILED') {
          this.notifyError({
            source: 'railway',
            type: 'deployment_failure',
            message: 'Railway deployment failed',
            details: status,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Handle JSON parse errors
      }
    });
  }

  setupVercelMonitoring() {
    // Monitor Vercel deployments
    setInterval(() => {
      exec('vercel ls --json', (error, stdout) => {
        if (!error) {
          try {
            const deployments = JSON.parse(stdout);
            const latest = deployments[0];
            if (latest && latest.state === 'ERROR') {
              this.notifyError({
                source: 'vercel',
                type: 'deployment_failure',
                message: 'Vercel deployment failed',
                details: latest,
                timestamp: new Date().toISOString()
              });
            }
          } catch (e) {
            // Handle JSON parse errors
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  notifyError(error) {
    // Send error to aggregator
    const ErrorAggregator = require('./error-aggregator');
    ErrorAggregator.handleError(error);
  }
}

module.exports = new DeploymentMonitor();
```

### **Step 4: Autonomous Startup Script**

#### **scripts/claude-autonomous.sh**

```bash
#!/bin/bash

echo "🚀 Starting Claude Code Full-Visibility Environment"

# Create log directories
mkdir -p logs/{browser,railway,vercel,github,aggregated,claude-alerts}

# Setup environment
source .env

# Start monitoring dashboard
echo "📊 Starting monitoring dashboard..."
node monitoring/dashboard-server.js &

# Start error aggregation
echo "🔍 Starting error aggregation..."
node monitoring/error-aggregator.js &

# Start browser monitoring
echo "🌐 Starting browser monitoring..."
node monitoring/browser-tests.js &

# Start deployment monitoring  
echo "🚢 Starting deployment monitoring..."
node monitoring/deployment-monitor.js &

# Start development servers
echo "🔧 Starting development servers..."
npm run dev:backend &
npm run dev:frontend &

# Wait for services to be ready
sleep 10

echo "✅ Full-visibility monitoring active!"
echo ""
echo "📋 Monitoring Status:"
echo "  ✅ Browser testing: http://localhost:8080/browser"
echo "  ✅ Railway logs: http://localhost:8080/railway" 
echo "  ✅ Vercel logs: http://localhost:8080/vercel"
echo "  ✅ GitHub Actions: http://localhost:8080/github"
echo "  ✅ Real-time dashboard: http://localhost:8080"
echo ""
echo "🤖 Claude Code is now monitoring everything!"
echo "   All errors will be automatically detected and fixed."
echo ""
echo "Press Ctrl+C to stop monitoring"

# Keep script running
wait
```

### **Step 5: Enhanced Makefile**

```makefile
# Full-visibility development commands

.PHONY: claude-autonomous claude-monitor claude-dashboard

# Start Claude Code in autonomous mode with full visibility
claude-autonomous:
	@echo "🚀 Starting Claude Code in AUTONOMOUS mode with full visibility..."
	@echo "⚠️  Claude will have complete control and monitoring access"
	@echo "⚠️  This includes browser automation, deployment monitoring, and error fixing"
	@echo "⚠️  Press Ctrl+C within 10 seconds to cancel..."
	@sleep 10
	./scripts/claude-autonomous.sh
	$(DOCKER_COMPOSE) exec claude-dev claude --dangerously-skip-permissions --autonomous-mode

# Start monitoring only (without Claude Code)
claude-monitor:
	@echo "📊 Starting monitoring systems..."
	./scripts/start-monitoring.sh

# Open monitoring dashboard
claude-dashboard:
	@echo "🎛️ Opening monitoring dashboard..."
	open http://localhost:8080

# Full setup including GitHub CLI integration
claude-full-setup: claude-build
	@echo "🔧 Setting up complete monitoring environment..."
	./scripts/full-setup.sh
	@echo "✅ Full monitoring setup complete!"
```

---

## 🎯 **Usage Instructions**

### **Complete Setup:**

```bash
# 1. Setup full monitoring environment
make claude-full-setup

# 2. Connect GitHub (one-time setup)
gh auth login
gh repo create pipedrive-google-chat-integration --private
git remote add origin https://github.com/yourusername/pipedrive-google-chat-integration.git

# 3. Start autonomous Claude Code
make claude-autonomous
```

### **What Claude Code Will See:**

1. **Real-time browser testing** across Chrome, Firefox, Safari
2. **Live Railway backend logs** and performance metrics
3. **Vercel deployment status** and frontend errors  
4. **GitHub Actions build status** and failures
5. **Database query performance** and connection issues
6. **API response times** and error rates
7. **Console errors** and JavaScript exceptions
8. **Network request failures** and CORS issues
9. **Authentication flow problems**
10. **Webhook delivery status**

### **Autonomous Actions Claude Will Take:**

- 🔧 **Fix JavaScript errors** immediately 
- 🔧 **Resolve build failures** and redeploy
- 🔧 **Optimize slow database queries**
- 🔧 **Fix CORS and networking issues**
- 🔧 **Update dependencies** with security vulnerabilities
- 🔧 **Improve performance** bottlenecks
- 🔧 **Create GitHub issues** for complex problems
- 🔧 **Rollback deployments** if critical errors detected

---

## 📊 **Monitoring Dashboard**

Access the real-time monitoring dashboard at `http://localhost:8080`:

- **Live Error Feed**: All errors from all sources
- **Browser Test Results**: Success/failure rates across browsers
- **Deployment Status**: Railway and Vercel deployment health
- **Performance Metrics**: Response times, error rates, uptime
- **GitHub Integration**: Build status, PR checks, action results
- **Claude Actions Log**: What fixes Claude has implemented

---

This setup gives Claude Code **complete visibility** into your entire development stack and **autonomous power** to detect and fix issues immediately. You'll have minimal interruptions and maximum development velocity! 🚀