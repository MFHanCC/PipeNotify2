const axios = require('axios');
const { execSync } = require('child_process');

class MinimalMonitor {
  constructor() {
    this.railwayUrl = 'https://pipenotify.up.railway.app';
    this.localUrl = 'http://localhost:3001';
    this.frontendUrl = 'https://pipenotify-frontend.vercel.app';
    this.isActive = false;
    this.fixAttempts = 0;
    this.maxFixAttempts = 3;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  async quickHealthCheck(service, url, endpoint = '', timeout = 5000) {
    try {
      const response = await axios.get(`${url}${endpoint}`, { timeout });
      return { service, status: 'healthy', code: response.status };
    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        error: error.message,
        code: error.response?.status || 0
      };
    }
  }

  async autoFixRailway() {
    if (this.fixAttempts >= this.maxFixAttempts) {
      this.log('Max fix attempts reached', 'warning');
      return false;
    }

    this.fixAttempts++;
    this.log(`Auto-fixing Railway (attempt ${this.fixAttempts}/${this.maxFixAttempts})`, 'info');

    try {
      execSync(`git commit --allow-empty -m "Auto-fix Railway ${this.fixAttempts}"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      this.log('Redeployment triggered', 'success');
      return true;
    } catch (error) {
      this.log(`Auto-fix failed: ${error.message}`, 'error');
      return false;
    }
  }

  async minimalCheck() {
    // Only check basic health - NO OAuth testing
    const checks = [
      this.quickHealthCheck('Railway', this.railwayUrl, '/health'),
      this.quickHealthCheck('Local Backend', this.localUrl, '/health'),
      this.quickHealthCheck('Frontend', this.frontendUrl),
    ];

    const results = await Promise.all(checks);
    const unhealthy = results.filter(r => r.status === 'unhealthy');

    // Only fix if Railway is completely down
    for (const issue of unhealthy) {
      if (issue.service === 'Railway' && (issue.code === 404 || issue.code === 0)) {
        this.log(`Railway is down (${issue.code}) - auto-fixing...`, 'warning');
        await this.autoFixRailway();
        break; // Only fix once per cycle
      }
    }

    return { healthy: results.filter(r => r.status === 'healthy').length, total: results.length };
  }

  async startMinimalMonitoring(intervalSeconds = 60) {
    this.isActive = true;
    this.log('Starting minimal monitoring (health checks only)...', 'info');

    while (this.isActive) {
      const results = await this.minimalCheck();
      this.log(`Health check: ${results.healthy}/${results.total} healthy`, 'info');
      
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
  }

  stop() {
    this.isActive = false;
    this.log('Stopping minimal monitoring...', 'info');
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new MinimalMonitor();
  
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
  
  // Start with 60-second intervals - no OAuth testing spam
  const interval = parseInt(process.argv[2]) || 60;
  monitor.startMinimalMonitoring(interval).catch(console.error);
}

module.exports = MinimalMonitor;