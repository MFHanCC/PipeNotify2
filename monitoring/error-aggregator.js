const fs = require('fs');
const path = require('path');

class ErrorAggregator {
  constructor() {
    this.errors = [];
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
    try {
      const railway = spawn('railway', ['logs', '--follow'], { stdio: 'pipe' });
      
      railway.stdout.on('data', (data) => {
        const logEntry = this.parseLogEntry(data.toString(), 'railway');
        if (logEntry.level === 'error') {
          this.handleError(logEntry);
        }
        this.saveLog('railway', logEntry);
      });

      railway.on('error', (error) => {
        console.log('Railway CLI not available:', error.message);
      });
    } catch (error) {
      console.log('Railway monitoring setup failed:', error.message);
    }
  }

  monitorVercelLogs() {
    const { spawn } = require('child_process');
    try {
      const vercel = spawn('vercel', ['logs', '--follow'], { stdio: 'pipe' });
      
      vercel.stdout.on('data', (data) => {
        const logEntry = this.parseLogEntry(data.toString(), 'vercel');
        if (logEntry.level === 'error') {
          this.handleError(logEntry);
        }
        this.saveLog('vercel', logEntry);
      });

      vercel.on('error', (error) => {
        console.log('Vercel CLI not available:', error.message);
      });
    } catch (error) {
      console.log('Vercel monitoring setup failed:', error.message);
    }
  }

  monitorBrowserErrors() {
    // This connects to browser automation to capture console errors
    try {
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
    } catch (error) {
      console.log('Browser monitoring setup failed:', error.message);
    }
  }

  monitorGitHubActions() {
    const { exec } = require('child_process');
    
    // Check if GitHub CLI is available
    exec('gh --version', (error) => {
      if (error) {
        console.log('GitHub CLI not available, skipping GitHub Actions monitoring');
        return;
      }

      // Monitor GitHub Actions periodically
      setInterval(() => {
        exec('gh run list --limit 1 --json status,conclusion,url', (error, stdout) => {
          if (!error && stdout) {
            try {
              const runs = JSON.parse(stdout);
              if (runs[0] && runs[0].conclusion === 'failure') {
                this.handleError({
                  source: 'github',
                  type: 'build_failure',
                  message: 'GitHub Action failed',
                  url: runs[0].url,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (e) {
              // Handle JSON parse errors silently
            }
          }
        });
      }, 30000); // Check every 30 seconds
    });
  }

  handleError(error) {
    console.log(`🚨 Error detected: ${error.source} - ${error.message}`);
    
    // Add to error list
    this.errors.push(error);
    
    // Send to Claude for immediate fixing
    this.sendToClaudeForFix(error);
    
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

    // This triggers Claude to take action
    try {
      if (!fs.existsSync('./logs/claude-alerts')) {
        fs.mkdirSync('./logs/claude-alerts', { recursive: true });
      }
      fs.writeFileSync('./logs/claude-alerts/error-' + Date.now() + '.txt', claudePrompt);
    } catch (err) {
      console.log('Failed to write Claude alert:', err.message);
    }
  }

  parseLogEntry(data, source) {
    return {
      source,
      timestamp: new Date().toISOString(),
      message: data.trim(),
      level: data.includes('ERROR') || data.includes('error') ? 'error' : 'info'
    };
  }

  saveLog(type, entry) {
    try {
      const logDir = `./logs/${type}`;
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = `${logDir}/${new Date().toISOString().split('T')[0]}.log`;
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.log(`Failed to save log for ${type}:`, error.message);
    }
  }

  setupDashboard() {
    // Setup dashboard placeholder
    console.log('📊 Error aggregation dashboard initialized');
  }
}

module.exports = new ErrorAggregator();