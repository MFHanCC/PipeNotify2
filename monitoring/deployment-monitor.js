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
          try {
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
          } catch (e) {
            console.log('GitHub monitoring error:', e.message);
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  setupRailwayMonitoring() {
    // Monitor Railway deployments with proper error handling
    setInterval(async () => {
      try {
        // Check Railway service status
        exec('railway status --json', { cwd: '../backend' }, (error, stdout, stderr) => {
          if (error) {
            console.log('Railway CLI error:', error.message);
            return;
          }
          
          try {
            const status = JSON.parse(stdout);
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
            console.log('Railway status parse error:', e.message);
          }
        });
        
        // Monitor recent Railway logs for errors
        exec('railway logs --num 50', { cwd: '../backend' }, (error, stdout, stderr) => {
          if (!error && stdout) {
            const logs = stdout.toString();
            
            // Check for critical errors in logs
            if (logs.includes('Error') || logs.includes('ERROR') || logs.includes('FATAL')) {
              const errorLines = logs.split('\n').filter(line => 
                line.toLowerCase().includes('error') || 
                line.toLowerCase().includes('fatal')
              );
              
              errorLines.forEach(line => {
                this.notifyError({
                  source: 'railway',
                  type: 'service_error',
                  message: line.trim(),
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        });
        
      } catch (error) {
        console.log('Railway monitoring cycle error:', error.message);
      }
    }, 30000); // Check every 30 seconds
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
            // Handle JSON parse errors silently
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  notifyError(error) {
    // Send error to aggregator
    try {
      const ErrorAggregator = require('./error-aggregator');
      ErrorAggregator.handleError(error);
    } catch (e) {
      console.log('Error aggregator not available:', e.message);
      // Fallback: save directly to logs
      this.saveErrorDirectly(error);
    }
  }

  saveErrorDirectly(error) {
    const logDir = './logs/aggregated';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = `${logDir}/${new Date().toISOString().split('T')[0]}.log`;
    fs.appendFileSync(logFile, JSON.stringify(error) + '\n');
  }
}

module.exports = new DeploymentMonitor();