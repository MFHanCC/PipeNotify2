const axios = require('axios');
const { execSync } = require('child_process');

class AutonomousMonitor {
  constructor() {
    this.railwayUrl = 'https://pipenotify.up.railway.app';
    this.frontendUrl = 'https://pipenotify-frontend.vercel.app';
    this.chatWebhook = 'https://chat.googleapis.com/v1/spaces/AAQASsBob7E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=reMpAdFngUO-J6g9278dze05lysc8CVlb7orJAdK0zQ';
    this.isMonitoring = false;
    this.lastStatus = {};
    this.fixAttempts = 0;
    this.maxFixAttempts = 5;
  }

  async sendChatNotification(message, isError = false) {
    try {
      const emoji = isError ? '🚨' : '🤖';
      await axios.post(this.chatWebhook, {
        text: `${emoji} **Pipenotify Autonomous Monitor**\n${message}\n_${new Date().toISOString()}_`
      });
    } catch (error) {
      console.log(`Failed to send chat notification: ${error.message}`);
    }
  }

  log(message, type = 'info', sendToChat = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (sendToChat) {
      this.sendChatNotification(message, type === 'error');
    }
  }

  async checkService(name, url, endpoint = '') {
    try {
      const fullUrl = `${url}${endpoint}`;
      const response = await axios.get(fullUrl, { timeout: 15000 });
      return { 
        name, 
        status: 'healthy', 
        code: response.status,
        details: `✅ ${name} responding normally (${response.status})`
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        code: error.response?.status || 0,
        error: error.message,
        details: `❌ ${name} error: ${error.response?.status || 'timeout'} - ${error.message}`
      };
    }
  }

  async runHealthChecks() {
    const checks = [
      this.checkService('Railway Backend', this.railwayUrl, '/health'),
      this.checkService('Railway API', this.railwayUrl, '/api/v1/status'),
      this.checkService('Frontend', this.frontendUrl),
    ];

    return await Promise.all(checks);
  }

  async testOAuthFlow() {
    try {
      const testData = {
        code: 'test_auth_code_autonomous_' + Date.now(),
        state: 'test_state'
      };

      const response = await axios.post(`${this.railwayUrl}/api/v1/oauth/callback`, testData, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      return {
        name: 'OAuth Flow',
        status: 'healthy',
        details: `✅ OAuth endpoint responding (${response.status})`
      };
    } catch (error) {
      return {
        name: 'OAuth Flow',
        status: 'unhealthy',
        error: error.message,
        code: error.response?.status || 0,
        details: `❌ OAuth test failed: ${error.response?.status || 'timeout'} - ${error.message}`
      };
    }
  }

  async attemptRailwayFix() {
    if (this.fixAttempts >= this.maxFixAttempts) {
      this.log('Max fix attempts reached - manual intervention required', 'error', true);
      return false;
    }

    this.fixAttempts++;
    this.log(`🔧 Auto-fix attempt ${this.fixAttempts}/${this.maxFixAttempts} - Triggering Railway redeployment`, 'warning', true);

    try {
      // Trigger redeployment with empty commit
      execSync(`git commit --allow-empty -m "Auto-fix Railway deployment attempt ${this.fixAttempts}"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      
      this.log('✅ Redeployment triggered - monitoring for recovery...', 'success', true);
      return true;
    } catch (error) {
      this.log(`❌ Failed to trigger redeployment: ${error.message}`, 'error', true);
      return false;
    }
  }

  async monitoringCycle() {
    this.log('🔍 Running monitoring cycle...', 'info');
    
    // Run health checks
    const healthChecks = await this.runHealthChecks();
    const oauthCheck = await this.testOAuthFlow();
    
    const allChecks = [...healthChecks, oauthCheck];
    const unhealthyServices = allChecks.filter(check => check.status === 'unhealthy');
    const healthyServices = allChecks.filter(check => check.status === 'healthy');
    
    // Log results
    healthyServices.forEach(service => {
      this.log(service.details, 'success');
    });
    
    unhealthyServices.forEach(service => {
      this.log(service.details, 'error');
    });

    // Check if Railway needs fixing
    const railwayIssues = unhealthyServices.filter(s => s.name.includes('Railway'));
    if (railwayIssues.length > 0) {
      // Only send chat notification if status changed
      if (this.lastStatus.railwayHealthy !== false) {
        await this.sendChatNotification(`🚨 Railway Backend Down\n${railwayIssues.map(s => s.details).join('\n')}\n🔧 Attempting automatic fix...`, true);
        await this.attemptRailwayFix();
      }
      this.lastStatus.railwayHealthy = false;
    } else if (railwayIssues.length === 0 && this.lastStatus.railwayHealthy === false) {
      // Railway recovered
      this.fixAttempts = 0; // Reset fix attempts on recovery
      await this.sendChatNotification(`✅ Railway Backend Recovered!\n${healthyServices.filter(s => s.name.includes('Railway')).map(s => s.details).join('\n')}`, false);
      this.lastStatus.railwayHealthy = true;
    }

    // Send periodic status updates (every 10 cycles when healthy)
    if (!this.statusUpdateCounter) this.statusUpdateCounter = 0;
    this.statusUpdateCounter++;
    
    if (this.statusUpdateCounter >= 10 && unhealthyServices.length === 0) {
      await this.sendChatNotification(`✅ All Systems Healthy\n• Railway Backend: Online\n• Frontend: Online\n• OAuth: Working\n• Monitoring: Active`);
      this.statusUpdateCounter = 0;
    }

    return {
      healthy: healthyServices.length,
      unhealthy: unhealthyServices.length,
      total: allChecks.length
    };
  }

  async startMonitoring(intervalMinutes = 2) {
    this.isMonitoring = true;
    this.log('🚀 Starting autonomous monitoring system...', 'info');
    
    // Send startup notification
    await this.sendChatNotification(`🚀 Autonomous Monitor Started\n• Checking Railway Backend\n• Monitoring OAuth Flow\n• Testing Google Chat Integration\n• Auto-fixing detected issues\n\n⏱️ Check interval: ${intervalMinutes} minutes`);

    // Initial check
    await this.monitoringCycle();

    // Start monitoring loop
    while (this.isMonitoring) {
      await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
      
      if (this.isMonitoring) {
        const results = await this.monitoringCycle();
        this.log(`📊 Cycle complete - Healthy: ${results.healthy}, Unhealthy: ${results.unhealthy}`, 'info');
      }
    }
  }

  stop() {
    this.isMonitoring = false;
    this.log('⏹️ Stopping autonomous monitoring...', 'info');
    this.sendChatNotification('⏹️ Autonomous monitoring stopped');
  }
}

// Start monitoring if run directly
if (require.main === module) {
  const monitor = new AutonomousMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
  
  // Start monitoring with 2-minute intervals
  monitor.startMonitoring(2).catch(console.error);
}

module.exports = AutonomousMonitor;