const { execSync } = require('child_process');
const axios = require('axios');

class RailwayDeploymentFixer {
  constructor() {
    this.railwayUrl = 'https://pipenotify.up.railway.app';
    this.maxRetries = 3;
    this.retryDelay = 30000; // 30 seconds
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  async checkDeploymentStatus() {
    try {
      const response = await axios.get(`${this.railwayUrl}/health`, { timeout: 10000 });
      this.log('✅ Railway deployment is healthy', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Railway deployment issue: ${error.message}`, 'error');
      return false;
    }
  }

  async triggerRedeployment() {
    try {
      this.log('🔄 Triggering redeployment via empty commit...', 'info');
      
      // Create empty commit to trigger deployment
      execSync('git commit --allow-empty -m "Trigger Railway redeployment - fix 404 errors"', { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      
      this.log('✅ Empty commit pushed to trigger redeployment', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Failed to trigger redeployment: ${error.message}`, 'error');
      return false;
    }
  }

  async waitForDeployment(timeoutMinutes = 5) {
    this.log(`⏳ Waiting for deployment to complete (${timeoutMinutes} min timeout)...`, 'info');
    
    const startTime = Date.now();
    const timeout = timeoutMinutes * 60 * 1000;
    
    while (Date.now() - startTime < timeout) {
      const isHealthy = await this.checkDeploymentStatus();
      if (isHealthy) {
        return true;
      }
      
      this.log('⏳ Deployment still in progress, waiting...', 'info');
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    }
    
    this.log('❌ Deployment timeout - manual intervention may be required', 'error');
    return false;
  }

  async autoFix() {
    this.log('🚀 Starting automatic Railway deployment fix...', 'info');
    
    // First, check current status
    const isHealthy = await this.checkDeploymentStatus();
    if (isHealthy) {
      this.log('✅ Railway deployment is already healthy', 'success');
      return true;
    }
    
    // Try to fix by triggering redeployment
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      this.log(`🔧 Fix attempt ${attempt}/${this.maxRetries}`, 'info');
      
      const deployed = await this.triggerRedeployment();
      if (!deployed) {
        continue;
      }
      
      // Wait for deployment to complete
      const success = await this.waitForDeployment();
      if (success) {
        this.log('🎉 Railway deployment fix successful!', 'success');
        return true;
      }
      
      if (attempt < this.maxRetries) {
        this.log(`⏳ Retrying in ${this.retryDelay/1000} seconds...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    this.log('❌ Automatic fix failed - manual intervention required', 'error');
    this.log('💡 Check Railway dashboard for detailed error logs', 'warning');
    return false;
  }
}

// CLI interface
if (require.main === module) {
  const fixer = new RailwayDeploymentFixer();
  fixer.autoFix().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = RailwayDeploymentFixer;