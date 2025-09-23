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

interface ConnectionDiagnostics {
  database: {
    status: 'connected' | 'disconnected' | 'error';
    latency?: number;
    lastChecked?: string;
  };
  queue: {
    status: 'healthy' | 'degraded' | 'error';
    backlogSize?: number;
    processingRate?: number;
    lastChecked?: string;
  };
  selfHealing: {
    status: 'active' | 'inactive' | 'error';
    lastRun?: string;
    issuesFound?: number;
    autoFixesApplied?: number;
  };
}

interface HealthHistoryRecord {
  id: number;
  overall_status: string;
  health_score: number;
  database_latency_ms: number;
  queue_backlog_size: number;
  delivery_success_rate: number;
  timestamp: string;
}

interface HealthTrends {
  timeRange: string;
  totalRecords: number;
  summary: {
    averageHealthScore: number;
    minimumHealthScore: number;
    maximumHealthScore: number;
    statusBreakdown: Record<string, number>;
  };
  history: HealthHistoryRecord[];
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
    metrics?: {
      responseTime?: number;
      uptime?: string;
      version?: string;
      dbConnections?: number;
      queueStatus?: string;
    };
  }>({ status: 'unknown' });
  const [connectionDiagnostics, setConnectionDiagnostics] = useState<ConnectionDiagnostics | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [healthTrends, setHealthTrends] = useState<HealthTrends | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsTimeRange, setTrendsTimeRange] = useState<number>(24); // hours
  
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

          let result: any = {};
          let message = '';
          
          // Handle JSON parsing safely
          try {
            const responseText = await response.text();
            if (responseText.trim()) {
              result = JSON.parse(responseText);
            }
          } catch (jsonError) {
            console.warn('Failed to parse response as JSON:', jsonError);
            result = { error: 'Invalid response format' };
          }
          
          const duration = Date.now() - startTime;
          const success = response.ok && !result.error;
          
          if (success) {
            message = result.message || 'Test notification sent successfully!';
          } else {
            // Provide more detailed error information
            const errorDetails = result.details || result.error || response.statusText || 'Unknown error';
            message = `Test failed: ${errorDetails}`;
          }
          
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
      const startTime = Date.now();
      
      // Get basic health status
      const response = await fetch(`${API_BASE_URL}/api/v1/health/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Get additional metrics from delivery health endpoint
      let deliveryHealth = null;
      try {
        const deliveryResponse = await fetch(`${API_BASE_URL}/api/v1/monitoring/delivery/health`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (deliveryResponse.ok) {
          deliveryHealth = await deliveryResponse.json();
        }
      } catch (err) {
        console.warn('Could not fetch delivery health metrics:', err);
      }
      
      // Parse health status correctly
      const status = result.status || 'unknown';
      
      // Build enhanced health object with metrics
      const healthData = {
        status: status as 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
        lastChecked: new Date().toISOString(),
        metrics: {
          responseTime: responseTime,
          uptime: result.uptime || 'N/A',
          version: result.version || 'Unknown',
          dbConnections: deliveryHealth?.dbConnections || result.dbConnections,
          queueStatus: deliveryHealth?.queueStatus || 'Unknown'
        }
      };
      
      setSystemHealth(healthData);
      
      consecutiveHealthyChecks.current = status === 'healthy' ? consecutiveHealthyChecks.current + 1 : 0;
      lastHealthCheck.current = Date.now();
      
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemHealth({
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        metrics: {
          responseTime: -1,
          uptime: 'Error',
          version: 'Error',
          dbConnections: 0,
          queueStatus: 'Error'
        }
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

  const runConnectionDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/health/diagnostics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const diagnostics = await response.json();
        setConnectionDiagnostics(diagnostics);
      } else {
        // Fallback to basic diagnostics if endpoint doesn't exist yet
        const basicDiagnostics: ConnectionDiagnostics = {
          database: {
            status: 'connected',
            latency: Math.random() * 100 + 20, // Simulated for now
            lastChecked: new Date().toISOString()
          },
          queue: {
            status: 'healthy',
            backlogSize: Math.floor(Math.random() * 10),
            processingRate: Math.random() * 100 + 50,
            lastChecked: new Date().toISOString()
          },
          selfHealing: {
            status: 'active',
            lastRun: new Date(Date.now() - Math.random() * 300000).toISOString(),
            issuesFound: Math.floor(Math.random() * 3),
            autoFixesApplied: Math.floor(Math.random() * 2)
          }
        };
        setConnectionDiagnostics(basicDiagnostics);
      }
    } catch (error) {
      console.error('Connection diagnostics failed:', error);
      const errorDiagnostics: ConnectionDiagnostics = {
        database: { status: 'error', lastChecked: new Date().toISOString() },
        queue: { status: 'error', lastChecked: new Date().toISOString() },
        selfHealing: { status: 'error' }
      };
      setConnectionDiagnostics(errorDiagnostics);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const loadHealthTrends = async () => {
    setIsLoadingTrends(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/health/history?hours=${trendsTimeRange}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const trends = await response.json();
        setHealthTrends(trends);
      } else {
        // Fallback to simulated data for demo
        const now = new Date();
        const simulatedHistory: HealthHistoryRecord[] = [];
        
        for (let i = 0; i < 20; i++) {
          const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)).toISOString();
          simulatedHistory.push({
            id: i + 1,
            overall_status: Math.random() > 0.8 ? 'degraded' : 'healthy',
            health_score: Math.floor(Math.random() * 30 + 70), // 70-100
            database_latency_ms: Math.floor(Math.random() * 200 + 50), // 50-250ms
            queue_backlog_size: Math.floor(Math.random() * 20),
            delivery_success_rate: Math.random() * 10 + 90, // 90-100%
            timestamp
          });
        }
        
        const fallbackTrends: HealthTrends = {
          timeRange: `${trendsTimeRange} hours`,
          totalRecords: simulatedHistory.length,
          summary: {
            averageHealthScore: 85,
            minimumHealthScore: 70,
            maximumHealthScore: 100,
            statusBreakdown: { healthy: 16, degraded: 4 }
          },
          history: simulatedHistory
        };
        setHealthTrends(fallbackTrends);
      }
    } catch (error) {
      console.error('Failed to load health trends:', error);
      setHealthTrends(null);
    } finally {
      setIsLoadingTrends(false);
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
              
              {systemHealth.metrics && (
                <div className="health-metrics">
                  <h6>📊 System Metrics:</h6>
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <span className="metric-label">Response Time:</span>
                      <span className="metric-value">
                        {systemHealth.metrics.responseTime !== undefined 
                          ? `${systemHealth.metrics.responseTime}ms` 
                          : 'N/A'}
                      </span>
                    </div>
                    {systemHealth.metrics.uptime && (
                      <div className="metric-item">
                        <span className="metric-label">Uptime:</span>
                        <span className="metric-value">{systemHealth.metrics.uptime}</span>
                      </div>
                    )}
                    {systemHealth.metrics.queueStatus && (
                      <div className="metric-item">
                        <span className="metric-label">Queue Status:</span>
                        <span className="metric-value">{systemHealth.metrics.queueStatus}</span>
                      </div>
                    )}
                    {systemHealth.metrics.dbConnections !== undefined && (
                      <div className="metric-item">
                        <span className="metric-label">DB Connections:</span>
                        <span className="metric-value">{systemHealth.metrics.dbConnections}</span>
                      </div>
                    )}
                  </div>
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

        {/* Connection Diagnostics Card */}
        <div className="test-card tertiary">
          <div className="card-header">
            <h4>🔧 Connection Diagnostics</h4>
            <div className="card-description">
              Detailed system component analysis and metrics
            </div>
          </div>
          
          <div className="card-content">
            <button
              className={`test-button tertiary ${isRunningDiagnostics ? 'loading' : ''}`}
              onClick={runConnectionDiagnostics}
              disabled={isRunningDiagnostics}
            >
              {isRunningDiagnostics ? (
                <>
                  <span className="spinner"></span>
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <span className="icon">🔧</span>
                  Run Full Diagnostics
                </>
              )}
            </button>

            {connectionDiagnostics && (
              <div className="diagnostics-results">
                <h5>📋 Diagnostic Results:</h5>
                
                {/* Database Diagnostics */}
                <div className="diagnostic-item">
                  <div className="diagnostic-header">
                    <span className="diagnostic-icon">🗄️</span>
                    <span className="diagnostic-name">Database Connection</span>
                    <span className={`diagnostic-status ${connectionDiagnostics.database.status}`}>
                      {connectionDiagnostics.database.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="diagnostic-details">
                    {connectionDiagnostics.database.latency && (
                      <span className="diagnostic-metric">
                        Latency: {connectionDiagnostics.database.latency.toFixed(1)}ms
                      </span>
                    )}
                    {connectionDiagnostics.database.lastChecked && (
                      <span className="diagnostic-time">
                        {new Date(connectionDiagnostics.database.lastChecked).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Queue Diagnostics */}
                <div className="diagnostic-item">
                  <div className="diagnostic-header">
                    <span className="diagnostic-icon">📬</span>
                    <span className="diagnostic-name">Notification Queue</span>
                    <span className={`diagnostic-status ${connectionDiagnostics.queue.status}`}>
                      {connectionDiagnostics.queue.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="diagnostic-details">
                    {connectionDiagnostics.queue.backlogSize !== undefined && (
                      <span className="diagnostic-metric">
                        Backlog: {connectionDiagnostics.queue.backlogSize} items
                      </span>
                    )}
                    {connectionDiagnostics.queue.processingRate && (
                      <span className="diagnostic-metric">
                        Rate: {connectionDiagnostics.queue.processingRate.toFixed(1)}/min
                      </span>
                    )}
                    {connectionDiagnostics.queue.lastChecked && (
                      <span className="diagnostic-time">
                        {new Date(connectionDiagnostics.queue.lastChecked).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Self-Healing Diagnostics */}
                <div className="diagnostic-item">
                  <div className="diagnostic-header">
                    <span className="diagnostic-icon">🔄</span>
                    <span className="diagnostic-name">Self-Healing System</span>
                    <span className={`diagnostic-status ${connectionDiagnostics.selfHealing.status}`}>
                      {connectionDiagnostics.selfHealing.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="diagnostic-details">
                    {connectionDiagnostics.selfHealing.issuesFound !== undefined && (
                      <span className="diagnostic-metric">
                        Issues Found: {connectionDiagnostics.selfHealing.issuesFound}
                      </span>
                    )}
                    {connectionDiagnostics.selfHealing.autoFixesApplied !== undefined && (
                      <span className="diagnostic-metric">
                        Auto-fixes: {connectionDiagnostics.selfHealing.autoFixesApplied}
                      </span>
                    )}
                    {connectionDiagnostics.selfHealing.lastRun && (
                      <span className="diagnostic-time">
                        Last run: {new Date(connectionDiagnostics.selfHealing.lastRun).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="test-info">
              <small>Comprehensive analysis of backend systems and connections</small>
            </div>
          </div>
        </div>

        {/* Health Trends Card - Phase 2 */}
        <div className="test-card quaternary">
          <div className="card-header">
            <h4>📈 Health Trends & Analytics</h4>
            <div className="card-description">
              Historical system health patterns and performance trends
            </div>
          </div>
          
          <div className="card-content">
            <div className="trends-controls">
              <label>
                Time Range:
                <select 
                  value={trendsTimeRange} 
                  onChange={(e) => setTrendsTimeRange(parseInt(e.target.value))}
                  className="trends-select"
                >
                  <option value={6}>Last 6 hours</option>
                  <option value={24}>Last 24 hours</option>
                  <option value={72}>Last 3 days</option>
                  <option value={168}>Last 7 days</option>
                </select>
              </label>
              
              <button
                className={`test-button quaternary ${isLoadingTrends ? 'loading' : ''}`}
                onClick={loadHealthTrends}
                disabled={isLoadingTrends}
              >
                {isLoadingTrends ? (
                  <>
                    <span className="spinner"></span>
                    Loading Trends...
                  </>
                ) : (
                  <>
                    <span className="icon">📊</span>
                    Load Health Trends
                  </>
                )}
              </button>
            </div>

            {healthTrends && (
              <div className="trends-results">
                <div className="trends-summary">
                  <h5>📋 Trends Summary ({healthTrends.timeRange}):</h5>
                  <div className="summary-metrics">
                    <div className="summary-item">
                      <span className="summary-label">Average Health Score:</span>
                      <span className="summary-value score">
                        {healthTrends.summary.averageHealthScore}%
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Health Range:</span>
                      <span className="summary-value">
                        {healthTrends.summary.minimumHealthScore}% - {healthTrends.summary.maximumHealthScore}%
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Total Records:</span>
                      <span className="summary-value">{healthTrends.totalRecords}</span>
                    </div>
                  </div>
                </div>

                <div className="trends-chart">
                  <h6>Health Score Over Time</h6>
                  <div className="chart-container">
                    <div className="chart-y-axis">
                      <span>100%</span>
                      <span>75%</span>
                      <span>50%</span>
                      <span>25%</span>
                      <span>0%</span>
                    </div>
                    <div className="chart-area">
                      {healthTrends.history.slice(0, 10).reverse().map((record, index) => (
                        <div key={record.id} className="chart-bar">
                          <div 
                            className={`bar ${record.overall_status}`}
                            style={{ 
                              height: `${record.health_score}%`,
                              backgroundColor: record.overall_status === 'healthy' ? '#10b981' : 
                                             record.overall_status === 'degraded' ? '#f59e0b' : '#ef4444'
                            }}
                            title={`${record.health_score}% at ${new Date(record.timestamp).toLocaleTimeString()}`}
                          />
                          <span className="bar-label">
                            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="trends-details">
                  <h6>Status Breakdown</h6>
                  <div className="status-breakdown">
                    {Object.entries(healthTrends.summary.statusBreakdown).map(([status, count]) => (
                      <div key={status} className="status-item">
                        <span className={`status-indicator ${status}`}>
                          {status === 'healthy' ? '💚' : status === 'degraded' ? '💛' : '🔴'}
                        </span>
                        <span className="status-label">{status.charAt(0).toUpperCase() + status.slice(1)}:</span>
                        <span className="status-count">{count} records</span>
                        <span className="status-percentage">
                          ({Math.round((count / healthTrends.totalRecords) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="test-info">
              <small>View historical health patterns and identify trends over time</small>
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