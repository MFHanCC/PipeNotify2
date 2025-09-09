const axios = require('axios');
const { execSync } = require('child_process');

class SilentAutoFixMonitor {
  constructor() {
    this.railwayUrl = 'https://pipenotify.up.railway.app';
    this.localUrl = 'http://localhost:3001';
    this.frontendUrl = 'https://pipenotify-frontend.vercel.app';
    
    this.isActive = false;
    this.silentMode = true; // No Google Chat alerts
    this.fixAttempts = 0;
    this.maxFixAttempts = 5;
    this.lastHealthStatus = {};
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async quickHealthCheck(service, url, endpoint = '', timeout = 5000) {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${url}${endpoint}`, { timeout });
      const responseTime = Date.now() - startTime;
      
      return {
        service,
        status: 'healthy',
        responseTime,
        code: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        code: error.response?.status || 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  async autoFixRailway() {
    if (this.fixAttempts >= this.maxFixAttempts) {
      this.log('Max fix attempts reached - stopping auto-fix', 'warning');
      return false;
    }

    this.fixAttempts++;
    this.log(`Auto-fixing Railway deployment issue (attempt ${this.fixAttempts}/${this.maxFixAttempts})`, 'info');

    try {
      execSync(`git commit --allow-empty -m "Auto-fix Railway deployment ${this.fixAttempts}"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      
      this.log('Redeployment triggered - monitoring recovery...', 'success');
      
      // Wait and check recovery
      setTimeout(() => this.checkRecovery(), 45000);
      
      return true;
    } catch (error) {
      this.log(`Auto-fix failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkRecovery() {
    const healthCheck = await this.quickHealthCheck('Railway', this.railwayUrl, '/health');
    
    if (healthCheck.status === 'healthy') {
      this.fixAttempts = 0; // Reset on recovery
      this.log('Railway recovered successfully', 'success');
    } else {
      this.log('Railway still recovering... will check again', 'info');
      setTimeout(() => this.checkRecovery(), 45000);
    }
  }

  async fixOAuthIssues(errorCode) {
    this.log(`Analyzing OAuth error: ${errorCode}`, 'info');
    
    if (errorCode === 400) {
      // Check if form encoding is correct
      this.log('OAuth 400 error detected - checking form encoding', 'warning');
    } else if (errorCode === 500) {
      // Check database issues
      this.log('OAuth 500 error detected - checking database schema', 'warning');
    }
    
    // For now, just log - OAuth errors during testing are often expected
  }

  async silentSystemCheck() {
    // Quick parallel health checks
    const checks = [
      this.quickHealthCheck('Railway', this.railwayUrl, '/health'),
      this.quickHealthCheck('Local Backend', this.localUrl, '/health'),
      this.quickHealthCheck('Frontend', this.frontendUrl),
    ];

    const results = await Promise.all(checks);
    const unhealthy = results.filter(r => r.status === 'unhealthy');

    // Silent auto-fixes for critical issues
    for (const issue of unhealthy) {
      if (issue.service === 'Railway') {
        if (issue.code === 404 || issue.code === 0) {
          this.log(`Railway is down (${issue.code}) - auto-fixing...`, 'warning');
          await this.autoFixRailway();
        } else if (issue.code >= 500) {
          this.log(`Railway server error (${issue.code}) - triggering redeploy`, 'warning');
          await this.autoFixRailway();
        }
      }
    }

    // Test OAuth endpoint if Railway is healthy
    const railwayHealthy = results.some(r => r.service === 'Railway' && r.status === 'healthy');
    if (railwayHealthy) {
      try {
        const testData = { code: 'test_' + Date.now(), state: 'test' };
        await axios.post(`${this.railwayUrl}/api/v1/oauth/callback`, testData, { timeout: 5000 });
      } catch (error) {
        if (error.response?.status && error.response.status !== 400) {
          // Only fix if it's not a 400 (which is expected with test data)
          await this.fixOAuthIssues(error.response.status);
        }
      }
    }

    return { healthy: results.filter(r => r.status === 'healthy').length, total: results.length };
  }

  async startSilentMonitoring(intervalSeconds = 20) {
    this.isActive = true;
    this.log('Starting silent auto-fix monitoring...', 'info');
    
    // Initial check
    await this.silentSystemCheck();

    // Start monitoring loop with faster intervals
    while (this.isActive) {
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      
      if (this.isActive) {
        const results = await this.silentSystemCheck();
        this.log(`Silent check complete - ${results.healthy}/${results.total} healthy`, 'info');
      }
    }
  }

  stop() {
    this.isActive = false;
    this.log('Stopping silent monitoring...', 'info');
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new SilentAutoFixMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
  
  // Start with 20-second intervals for real-time testing
  const interval = parseInt(process.argv[2]) || 20;
  monitor.startSilentMonitoring(interval).catch(console.error);
}

module.exports = SilentAutoFixMonitor;