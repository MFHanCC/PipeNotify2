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
    // Monitor Railway deployments
    try {
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
          // Handle JSON parse errors silently
        }
      });

      railway.stderr.on('data', (data) => {
        console.log('Railway monitoring error:', data.toString());
      });

      railway.on('error', (error) => {
        console.log('Railway CLI not available:', error.message);
      });
    } catch (error) {
      console.log('Railway monitoring setup failed:', error.message);
    }
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