import React, { useState, useEffect, useRef } from 'react';
import './TestingSection.css';
import { API_BASE_URL } from '../config/api';

interface TestResult {
  id: number;
  type: string;
  timestamp: string;
  success: boolean;
  message: string;
  duration?: number;
}

interface WebhookTestResult {
  webhookId: string;
  webhookName: string;
  success: boolean;
  message: string;
  duration: number;
  timestamp: string;
}

interface Webhook {
  id: string;
  name: string;
  webhook_url: string;
  description?: string;
}

interface TestingSectionProps {
  onTestComplete?: (result: TestResult) => void;
}

const TestingSection: React.FC<TestingSectionProps> = ({ onTestComplete }) => {
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [isTestingSystem, setIsTestingSystem] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestResult | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [webhookTestResults, setWebhookTestResults] = useState<WebhookTestResult[]>([]);
  const [testAllWebhooks, setTestAllWebhooks] = useState(true);
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

  const handleWebhookSelection = (webhookId: string, selected: boolean) => {
    if (selected) {
      setSelectedWebhooks(prev => [...prev, webhookId]);
    } else {
      setSelectedWebhooks(prev => prev.filter(id => id !== webhookId));
    }
  };

  const toggleTestAllWebhooks = (testAll: boolean) => {
    setTestAllWebhooks(testAll);
    if (testAll) {
      setSelectedWebhooks(webhooks.map(w => w.id));
    }
  };

  // Load webhooks on component mount
  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const apiModule = await import('../services/api');
      const apiService = apiModule.default;
      const webhookList = await apiService.getWebhooks();
      setWebhooks(webhookList);
      // Initially select all webhooks
      setSelectedWebhooks(webhookList.map((w: Webhook) => w.id));
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    }
  };

  const sendLiveTest = async () => {
    if (webhooks.length === 0) {
      alert('No webhooks found. Please configure at least one webhook first.');
      return;
    }

    setIsTestingLive(true);
    setWebhookTestResults([]);
    
    try {
      const token = localStorage.getItem('auth_token');
      const webhooksToTest = testAllWebhooks ? webhooks : webhooks.filter(w => selectedWebhooks.includes(w.id));
      
      if (webhooksToTest.length === 0) {
        alert('Please select at least one webhook to test.');
        setIsTestingLive(false);
        return;
      }

      const results: WebhookTestResult[] = [];
      
      // Test each webhook individually
      for (const webhook of webhooksToTest) {
        const startTime = Date.now();
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/admin/webhooks/${webhook.id}/test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            }
          });

          const result = await response.json();
          const duration = Date.now() - startTime;
          
          const success = response.ok && !result.error;
          const message = success 
            ? `Test notification sent successfully!`
            : `Test failed: ${result.error || 'Unknown error'}`;
          
          results.push({
            webhookId: webhook.id,
            webhookName: webhook.name,
            success,
            message,
            duration,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          const duration = Date.now() - startTime;
          results.push({
            webhookId: webhook.id,
            webhookName: webhook.name,
            success: false,
            message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            duration,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      setWebhookTestResults(results);
      
      // Create overall test result
      const successCount = results.filter(r => r.success).length;
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      
      const testResult: TestResult = {
        id: Date.now(),
        type: 'live_test',
        timestamp: new Date().toISOString(),
        success: successCount > 0,
        message: `${successCount}/${results.length} webhooks tested successfully`,
        duration: totalDuration
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
        duration: 0
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
      const response = await fetch(`${API_BASE_URL}/api/v1/health/notifications`, {
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
      
      consecutiveHealthyChecks.current = status === 'healthy' ? consecutiveHealthyChecks.current + 1 : 0;
      lastHealthCheck.current = Date.now();
      
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemHealth({
        status: 'unhealthy',
        lastChecked: new Date().toISOString()
      });
      consecutiveHealthyChecks.current = 0;
    } finally {
      setIsTestingSystem(false);
    }
  };

  const startAutoMonitoring = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set up monitoring interval (5 minutes)
    intervalRef.current = setInterval(() => {
      // Only auto-check if we haven't checked recently
      const timeSinceLastCheck = Date.now() - lastHealthCheck.current;
      if (timeSinceLastCheck > 4 * 60 * 1000) { // 4 minutes
        checkSystemHealth();
      }
      
      // Update countdown
      const timeToNextCheck = 5 * 60 * 1000 - (Date.now() - lastHealthCheck.current);
      setNextCheckIn(Math.max(0, Math.floor(timeToNextCheck / 1000)));
    }, 1000);
  };

  // Auto-monitoring effect
  useEffect(() => {
    if (autoMonitoring) {
      // Initial health check
      checkSystemHealth();
      startAutoMonitoring();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoMonitoring]);

  // Another monitoring effect
  useEffect(() => {
    if (autoMonitoring) {
      startAutoMonitoring();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '💚';
      case 'degraded': return '💛';
      case 'unhealthy': return '🔴';
      default: return '❓';
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'degraded': return '#ffc107';
      case 'unhealthy': return '#dc3545';
      default: return '#6c757d';
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
              Send test notifications to your Google Chat webhooks
            </div>
          </div>
          
          <div className="card-content">
            {webhooks.length > 0 && (
              <div className="webhook-selection">
                <div className="selection-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={testAllWebhooks}
                      onChange={(e) => toggleTestAllWebhooks(e.target.checked)}
                    />
                    Test All Webhooks ({webhooks.length} found)
                  </label>
                </div>
                
                {!testAllWebhooks && (
                  <div className="webhook-list">
                    {webhooks.map(webhook => (
                      <label key={webhook.id} className="webhook-option">
                        <input
                          type="checkbox"
                          checked={selectedWebhooks.includes(webhook.id)}
                          onChange={(e) => handleWebhookSelection(webhook.id, e.target.checked)}
                        />
                        {webhook.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <button
              className={`test-button primary ${isTestingLive ? 'loading' : ''}`}
              onClick={sendLiveTest}
              disabled={isTestingLive || webhooks.length === 0}
            >
              {isTestingLive ? (
                <>
                  <span className="spinner"></span>
                  Testing Webhooks...
                </>
              ) : (
                <>
                  <span className="icon">🚀</span>
                  Send Test Messages
                </>
              )}
            </button>
            
            {webhookTestResults.length > 0 && (
              <div className="test-results">
                <h5>📊 Test Results:</h5>
                {webhookTestResults.map(result => (
                  <div key={result.webhookId} className={`result-item ${result.success ? 'success' : 'error'}`}>
                    <span className="result-icon">{result.success ? '✅' : '❌'}</span>
                    <span className="webhook-name">{result.webhookName}</span>
                    <span className="result-message">{result.message}</span>
                    <span className="result-duration">({result.duration}ms)</span>
                  </div>
                ))}
                <div className="result-summary">
                  Summary: {webhookTestResults.filter(r => r.success).length}/{webhookTestResults.length} successful
                </div>
              </div>
            )}
            
            <div className="test-info">
              <small>This will send actual test notifications to your selected Google Chat webhooks</small>
            </div>
          </div>
        </div>

        {/* System Health Card */}
        <div className="test-card secondary">
          <div className="card-header">
            <h4>📊 System Health Monitor</h4>
            <div className="card-description">
              Monitor notification system status and performance
            </div>
          </div>
          
          <div className="card-content">
            <div className="health-status">
              <div className="status-indicator">
                <span className="status-icon">{getHealthStatusIcon(systemHealth.status)}</span>
                <span 
                  className="status-text"
                  style={{ color: getHealthStatusColor(systemHealth.status) }}
                >
                  {systemHealth.status.toUpperCase()}
                </span>
              </div>
              
              {systemHealth.lastChecked && (
                <div className="last-checked">
                  Last checked: {new Date(systemHealth.lastChecked).toLocaleTimeString()}
                </div>
              )}
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
                  Check System Health
                </>
              )}
            </button>

            <div className="monitoring-controls">
              <label className="monitoring-toggle">
                <input
                  type="checkbox"
                  checked={autoMonitoring}
                  onChange={(e) => setAutoMonitoring(e.target.checked)}
                />
                Auto-monitor (5 min intervals)
              </label>
              
              {autoMonitoring && nextCheckIn > 0 && (
                <div className="next-check">
                  Next check in: {Math.floor(nextCheckIn / 60)}:{(nextCheckIn % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Test Result */}
      {lastTestResult && (
        <div className="latest-result">
          <h4>📊 Latest Test Result</h4>
          <div className={`result-card ${lastTestResult.success ? 'success' : 'error'}`}>
            <div className="result-header">
              <span className="result-status">
                {lastTestResult.success ? '✅' : '❌'}
              </span>
              <span className="result-type">
                {lastTestResult.success ? 'Success' : 'Failed'}
              </span>
            </div>
            <div className="result-details">
              <div className="result-message">{lastTestResult.message}</div>
              <div className="result-metadata">
                <span>Type: {lastTestResult.type}</span>
                {lastTestResult.duration && <span>Duration: {lastTestResult.duration}ms</span>}
                <span>Time: {new Date(lastTestResult.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestingSection;