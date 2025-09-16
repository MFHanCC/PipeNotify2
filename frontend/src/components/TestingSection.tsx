import React, { useState, useEffect, useRef } from 'react';
import './TestingSection.css';

interface TestResult {
  id: number;
  type: string;
  timestamp: string;
  success: boolean;
  message: string;
  duration?: number;
}

interface TestingSectionProps {
  onTestComplete?: (result: TestResult) => void;
}

const TestingSection: React.FC<TestingSectionProps> = ({ onTestComplete }) => {
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [isTestingSystem, setIsTestingSystem] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestResult | null>(null);
  const [systemHealth, setSystemHealth] = useState<{
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastChecked?: string;
  }>({ status: 'unknown' });
  
  // Automated health monitoring
  const [autoMonitoring, setAutoMonitoring] = useState(true);
  const [nextCheckIn, setNextCheckIn] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthCheck = useRef<number>(0);
  const consecutiveHealthyChecks = useRef<number>(0);

  const sendLiveTest = async () => {
    setIsTestingLive(true);
    const startTime = Date.now();
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/health/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType: 'deal.won',
          companyId: '13887824',
          tenantId: 'auto' // Let backend determine from token
        }),
      });

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      // Health endpoint returns different format: overallResult, notificationsSent
      const success = response.ok && (result.overallResult === 'success' || result.notificationsSent > 0);
      const message = success 
        ? `✅ Test notification sent successfully! ${result.notificationsSent || 1} messages delivered`
        : `❌ Test failed: ${result.fallbackTest?.error || result.message || 'No notifications sent'}`;
      
      const testResult: TestResult = {
        id: Date.now(),
        type: 'live_test',
        timestamp: new Date().toISOString(),
        success,
        message,
        duration
      };
      
      setLastTestResult(testResult);
      onTestComplete?.(testResult);
      
    } catch (error) {
      const testResult: TestResult = {
        id: Date.now(),
        type: 'live_test', 
        timestamp: new Date().toISOString(),
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
      
      setLastTestResult(testResult);
      onTestComplete?.(testResult);
    } finally {
      setIsTestingLive(false);
    }
  };

  const checkSystemHealth = async () => {
    setIsTestingSystem(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/health/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      
      // Parse health status correctly
      const status = result.status || 'unknown';
      
      setSystemHealth({
        status: status as 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
        lastChecked: new Date().toISOString()
      });
      
      const testResult: TestResult = {
        id: Date.now(),
        type: 'system_health',
        timestamp: new Date().toISOString(),
        success: response.ok && status === 'healthy',
        message: result.overallHealth || `System status: ${status.toUpperCase()}`
      };
      
      setLastTestResult(testResult);
      onTestComplete?.(testResult);
      
    } catch (error) {
      setSystemHealth({
        status: 'unhealthy',
        lastChecked: new Date().toISOString()
      });
      
      const testResult: TestResult = {
        id: Date.now(),
        type: 'system_health',
        timestamp: new Date().toISOString(),
        success: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      setLastTestResult(testResult);
      onTestComplete?.(testResult);
    } finally {
      setIsTestingSystem(false);
    }
  };

  // Automated health monitoring
  const performAutoHealthCheck = async () => {
    if (!autoMonitoring || document.hidden) return;
    
    // Don't auto-check if user is manually testing
    if (isTestingSystem || isTestingLive) return;
    
    lastHealthCheck.current = Date.now();
    await checkSystemHealth();
    
    // Smart interval: if system is consistently healthy, check less frequently
    if (systemHealth.status === 'healthy') {
      consecutiveHealthyChecks.current += 1;
    } else {
      consecutiveHealthyChecks.current = 0;
    }
  };

  const getNextCheckInterval = () => {
    // Base interval: 60 seconds
    let interval = 60000;
    
    // If system has been healthy for a while, check less frequently
    if (consecutiveHealthyChecks.current > 5) {
      interval = 120000; // 2 minutes
    }
    if (consecutiveHealthyChecks.current > 15) {
      interval = 300000; // 5 minutes
    }
    
    return interval;
  };

  const startAutoMonitoring = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const runCheck = () => {
      performAutoHealthCheck();
      
      // Schedule next check
      const nextInterval = getNextCheckInterval();
      setNextCheckIn(nextInterval / 1000); // Convert to seconds for display
      
      intervalRef.current = setTimeout(runCheck, nextInterval);
    };
    
    // Initial check in 2 seconds, then start regular interval
    setTimeout(runCheck, 2000);
  };

  const stopAutoMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setNextCheckIn(0);
  };

  // Setup auto-monitoring and cleanup
  useEffect(() => {
    if (autoMonitoring) {
      startAutoMonitoring();
    } else {
      stopAutoMonitoring();
    }
    
    return () => stopAutoMonitoring();
  }, [autoMonitoring, systemHealth.status]);

  // Countdown timer for next check
  useEffect(() => {
    if (nextCheckIn <= 0 || !autoMonitoring) return;
    
    const timer = setInterval(() => {
      setNextCheckIn(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [nextCheckIn, autoMonitoring]);

  // Pause monitoring when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoMonitoring();
      } else if (autoMonitoring) {
        startAutoMonitoring();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoMonitoring]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'unhealthy': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="testing-section">
      <div className="section-header">
        <h3>🧪 System Testing</h3>
        <p>Test your notification pipeline and monitor system health</p>
      </div>

      <div className="testing-grid">
        {/* Live Test Card */}
        <div className="test-card primary">
          <div className="card-header">
            <h4>🚀 Live Notification Test</h4>
            <div className="card-description">
              Send a real test notification to your Google Chat channel
            </div>
          </div>
          
          <div className="card-content">
            <button
              className={`test-button primary ${isTestingLive ? 'loading' : ''}`}
              onClick={sendLiveTest}
              disabled={isTestingLive}
            >
              {isTestingLive ? (
                <>
                  <span className="spinner"></span>
                  Sending Test...
                </>
              ) : (
                <>
                  <span className="icon">🚀</span>
                  Send Test Message
                </>
              )}
            </button>
            
            <div className="test-info">
              <small>This will send an actual notification using your configured rules and webhooks</small>
            </div>
          </div>
        </div>

        {/* System Health Card */}
        <div className="test-card">
          <div className="card-header">
            <h4>🔍 System Health</h4>
            <div className="card-description">
              Check the overall health of your notification pipeline
            </div>
          </div>
          
          <div className="card-content">
            <div className="health-status">
              <div className="status-indicator">
                <span 
                  className="status-dot"
                  style={{ backgroundColor: getStatusColor(systemHealth.status) }}
                ></span>
                <span className="status-text">
                  {getStatusIcon(systemHealth.status)} {systemHealth.status.toUpperCase()}
                </span>
              </div>
              
              {systemHealth.lastChecked && (
                <div className="last-checked">
                  Last checked: {new Date(systemHealth.lastChecked).toLocaleTimeString()}
                </div>
              )}
              
              {autoMonitoring && nextCheckIn > 0 && (
                <div className="auto-check-countdown">
                  Next auto-check in: {Math.floor(nextCheckIn / 60)}:{(nextCheckIn % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
            
            <div className="auto-monitoring-controls">
              <label className="auto-monitoring-toggle">
                <input
                  type="checkbox"
                  checked={autoMonitoring}
                  onChange={(e) => setAutoMonitoring(e.target.checked)}
                />
                <span className="toggle-text">
                  🔄 Auto-monitor (every {consecutiveHealthyChecks.current > 5 ? 
                    consecutiveHealthyChecks.current > 15 ? '5 min' : '2 min' : '1 min'})
                </span>
              </label>
            </div>
            
            <button
              className={`test-button secondary ${isTestingSystem ? 'loading' : ''}`}
              onClick={checkSystemHealth}
              disabled={isTestingSystem}
            >
              {isTestingSystem ? (
                <>
                  <span className="spinner"></span>
                  Checking...
                </>
              ) : (
                <>
                  <span className="icon">🔍</span>
                  Check Health
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Result Card */}
        {lastTestResult && (
          <div className={`test-card result ${lastTestResult.success ? 'success' : 'failure'}`}>
            <div className="card-header">
              <h4>📊 Latest Test Result</h4>
            </div>
            
            <div className="card-content">
              <div className="result-summary">
                <div className="result-status">
                  <span className="result-icon">
                    {lastTestResult.success ? '✅' : '❌'}
                  </span>
                  <span className="result-text">
                    {lastTestResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                
                <div className="result-details">
                  <div className="result-message">{lastTestResult.message}</div>
                  <div className="result-meta">
                    <span>Type: {lastTestResult.type.replace('_', ' ')}</span>
                    {lastTestResult.duration && (
                      <span>Duration: {lastTestResult.duration}ms</span>
                    )}
                    <span>Time: {new Date(lastTestResult.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Info Card */}
        <div className="test-card info">
          <div className="card-header">
            <h4>💡 Testing Tips</h4>
          </div>
          
          <div className="card-content">
            <ul className="tips-list">
              <li><strong>Live Test:</strong> Sends a real notification to verify end-to-end functionality</li>
              <li><strong>Health Check:</strong> Validates database, queue, and webhook connectivity</li>
              <li><strong>Best Practice:</strong> Test after making configuration changes</li>
              <li><strong>Troubleshooting:</strong> Check the Activity Logs tab if tests fail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingSection;