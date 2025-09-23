import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './OnboardingWizard.css';
import { getAuthToken, setAuthToken, getAuthHeaders, authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';
import { autoSetupTimezone } from '../utils/timezone';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  isCompleted: boolean;
  canSkip?: boolean;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface WebhookFormData {
  name: string;
  webhook_url: string;
  description: string;
}

interface RuleFormData {
  name: string;
  event_type: string;
  target_webhook_id: string;
  template_mode: string;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onSkip }) => {
  // Initialize step based on whether we're handling OAuth callback
  const [currentStep, setCurrentStep] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    // If we have OAuth code, we're coming from Pipedrive and should go to step 3
    return code ? 2 : 0;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookFormData, setWebhookFormData] = useState<WebhookFormData>({
    name: '',
    webhook_url: '',
    description: ''
  });
  const [ruleFormData, setRuleFormData] = useState<RuleFormData>({
    name: 'My First Notification Rule',
    event_type: 'deal.won',
    target_webhook_id: '',
    template_mode: 'simple'
  });
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [isPipedriveConnected, setIsPipedriveConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isCheckingWebhooks, setIsCheckingWebhooks] = useState(() => {
    // If we're coming from OAuth callback, we should show loading state
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('code');
  });
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Enhanced error handling
  const handleApiError = useCallback((error: any, operation: string) => {
    let message = `Failed to ${operation}`;
    if (error?.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error?.status === 403) {
      message = 'Permission denied. Please check your access rights.';
    } else if (error?.message) {
      message = error.message;
    }
    setError(message);
  }, []);

  // Validation helper
  const validateWebhookForm = useMemo(() => {
    const errors: {[key: string]: string} = {};
    
    if (!webhookFormData.name.trim()) {
      errors.name = 'Webhook name is required';
    }
    
    if (!webhookFormData.webhook_url.trim()) {
      errors.webhook_url = 'Webhook URL is required';
    } else if (!webhookFormData.webhook_url.includes('chat.googleapis.com')) {
      errors.webhook_url = 'Please enter a valid Google Chat webhook URL';
    }
    
    return errors;
  }, [webhookFormData]);

  // Check user's current setup status and handle OAuth callback
  useEffect(() => {
    // Handle OAuth callback if code is present
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleOAuthCallback(code);
    } else {
      checkSetupStatus();
      checkPipedriveConnection();
    }
  }, []);

  const checkSetupStatus = async () => {
    try {
      // Only check setup status if user is authenticated
      const token = getAuthToken();
      if (!token) {
        console.log('No auth token found, skipping setup status check');
        // Clear webhook state when no token exists (e.g., incognito mode)
        setWebhooks([]);
        setIsCheckingWebhooks(false);
        return;
      }

      setIsCheckingWebhooks(true);
      const apiUrl = API_BASE_URL;
      
      console.log('🔍 Checking setup status - fetching webhooks...');
      
      // Add timeout to prevent infinite hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Webhook fetch timeout after 10 seconds');
        controller.abort();
      }, 10000);

      try {
        const [response] = await Promise.all([
          authenticatedFetch(`${apiUrl}/api/v1/admin/webhooks`, {
            signal: controller.signal
          }),
          new Promise(resolve => setTimeout(resolve, 800)) // Minimum 800ms delay
        ]);
        
        clearTimeout(timeoutId);
        console.log('✅ Webhook fetch completed:', response.status);

      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
        if (data.webhooks && data.webhooks.length > 0) {
          setRuleFormData(prev => ({ ...prev, target_webhook_id: data.webhooks[0].id }));
        }
      } else {
        // Clear webhook state on error (e.g., unauthorized)
        setWebhooks([]);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      // Clear webhook state on error
      setWebhooks([]);
    } finally {
      setIsCheckingWebhooks(false);
    }
  };

  const checkPipedriveConnection = async () => {
    try {
      setIsCheckingConnection(true);
      const token = getAuthToken();
      
      if (!token) {
        setIsPipedriveConnected(false);
        setIsCheckingConnection(false);
        return;
      }

      const apiUrl = API_BASE_URL;
      const response = await authenticatedFetch(`${apiUrl}/api/v1/oauth/profile`);

      setIsPipedriveConnected(response.ok);
    } catch (error) {
      console.error('Error checking Pipedrive connection:', error);
      setIsPipedriveConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      setIsCheckingConnection(true);
      const apiUrl = API_BASE_URL;
      
      const response = await fetch(`${apiUrl}/api/v1/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        const data = await response.json();
        setAuthToken(data.access_token, data.refresh_token, data.expires_in);
        setIsPipedriveConnected(true);
        
        // Auto-detect and save user's timezone
        console.log('🕐 Setting up user timezone...');
        await autoSetupTimezone(API_BASE_URL);
        
        // Advance to step 3 (webhook setup) immediately after successful Pipedrive connection
        setCurrentStep(2);
        
        // Clean up URL by removing the code parameter
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Load setup status now that we're authenticated
        await checkSetupStatus();
      } else {
        console.error('OAuth callback failed');
        setIsPipedriveConnected(false);
      }
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      setIsPipedriveConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const createDefaultRules = async () => {
    try {
      if (!webhooks.length) {
        console.log('No webhooks available, skipping default rule creation');
        return true;
      }

      const apiUrl = API_BASE_URL;
      const defaultRules = [
        {
          name: 'Deal Won Notifications',
          event_type: 'deal.won',
          target_webhook_id: webhooks[0].id,
          template_mode: 'simple'
        },
        {
          name: 'New Deal Notifications', 
          event_type: 'deal.added',
          target_webhook_id: webhooks[0].id,
          template_mode: 'simple'
        }
      ];

      // Create default rules based on user tier (could be expanded)
      for (const rule of defaultRules) {
        const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rule)
        });
        
        if (!response.ok) {
          console.warn('Failed to create default rule:', rule.name);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error creating default rules:', error);
      return false;
    }
  };

  const createWebhook = async () => {
    try {
      setIsLoading(true);
      const apiUrl = API_BASE_URL;
      
      // Check if backend is available
      try {
        const healthCheck = await fetch(`${apiUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (!healthCheck.ok) {
          throw new Error('Backend not available');
        }
      } catch (healthError) {
        console.error('Backend not available for webhook creation');
        alert('❌ Backend service is offline. Please ensure the backend is running to create webhooks.');
        return false;
      }
      
      // Backend is available, proceed with normal creation
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/webhooks`, {
        method: 'POST',
        body: JSON.stringify(webhookFormData)
      });

      if (response.ok) {
        await checkSetupStatus(); // Refresh webhooks list
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create webhook');
      }
    } catch (error) {
      console.error('Error creating webhook:', error);
      alert(`❌ Failed to create webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createRule = async () => {
    try {
      setIsLoading(true);
      const apiUrl = API_BASE_URL;
      
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules`, {
        method: 'POST',
        body: JSON.stringify({
          ...ruleFormData,
          filters: {},
          enabled: true
        })
      });

      if (response.ok) {
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create rule');
      }
    } catch (error) {
      console.error('Error creating rule:', error);
      alert(`❌ Failed to create rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    try {
      setIsLoading(true);
      const apiUrl = API_BASE_URL;
      
      const selectedWebhook = webhooks.find(w => w.id === ruleFormData.target_webhook_id);
      if (!selectedWebhook) {
        throw new Error('No webhook selected');
      }

      // Check if backend is available
      try {
        const healthCheck = await fetch(`${apiUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (!healthCheck.ok) {
          throw new Error('Backend not available');
        }
      } catch (healthError) {
        console.error('Backend not available for testing webhook');
        setTestResult({
          success: false,
          message: '❌ Backend service is offline. Cannot test webhook at this time.'
        });
        return false;
      }

      // Backend is available, proceed with actual test
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/webhooks/${selectedWebhook.id}/test`, {
        method: 'POST'
      });

      if (response.ok) {
        setTestResult({
          success: true,
          message: 'Test notification sent successfully! Check your Google Chat.'
        });
        return true;
      } else {
        const errorData = await response.json();
        setTestResult({
          success: false,
          message: errorData.error || 'Test notification failed'
        });
        return false;
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test notification failed'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const allSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Pipenotify! 🎉',
      description: 'Get real-time Pipedrive notifications in Google Chat',
      isCompleted: true,
      component: (
        <div className="welcome-step">
          <div className="welcome-hero">
            <div className="welcome-icon">🚀</div>
            <h2>Transform Your Sales Workflow</h2>
            <p>Pipenotify bridges your Pipedrive CRM with Google Chat, delivering real-time notifications about deals, activities, and important sales events directly to your team.</p>
          </div>
          
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h4>Real-time Notifications</h4>
              <p>Get instant alerts when deals change, close, or need attention</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h4>Smart Routing</h4>
              <p>Route different notifications to specific channels automatically</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔕</div>
              <h4>Quiet Hours</h4>
              <p>Respect your team's time with configurable quiet periods</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h4>Rich Templates</h4>
              <p>Customizable message formats with 50+ data variables</p>
            </div>
          </div>
          
          <div className="setup-time">
            <div className="time-badge">⏱️ Setup takes 5 minutes</div>
          </div>
        </div>
      )
    },
    {
      id: 'pipedrive',
      title: 'Connect Your Pipedrive Account 🔗',
      description: 'We need access to your Pipedrive data to send notifications',
      isCompleted: isPipedriveConnected,
      component: (
        <div className="pipedrive-step">
          {isCheckingConnection ? (
            <div className="connection-status checking">
              <div className="status-icon">⏳</div>
              <div className="status-content">
                <h3>Checking Pipedrive Connection...</h3>
                <p>Please wait while we verify your authentication status.</p>
              </div>
            </div>
          ) : isPipedriveConnected ? (
            <div className="connection-status success">
              <div className="status-icon">✅</div>
              <div className="status-content">
                <h3>Pipedrive Connected Successfully!</h3>
                <p>Your Pipedrive account is connected and ready to send webhook notifications.</p>
              </div>
            </div>
          ) : (
            <div className="connection-status pending">
              <div className="status-icon">🔗</div>
              <div className="status-content">
                <h3>Connect to Pipedrive</h3>
                <p>To get started, we need to connect to your Pipedrive account to access deal and activity data.</p>
                
                {!isCheckingConnection && !isPipedriveConnected && (
                  <div className="connection-notice">
                    <p><em>Please ensure the backend service is running and connect to Pipedrive to continue.</em></p>
                  </div>
                )}
                
                <button 
                  className="connect-button"
                  onClick={() => {
                    const clientId = process.env.REACT_APP_PIPEDRIVE_CLIENT_ID;
                    const redirectUri = encodeURIComponent(process.env.REACT_APP_PIPEDRIVE_REDIRECT_URI || `${window.location.origin}/onboarding`);
                    const authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
                    
                    // Debug logging
                    console.log('🔍 OAuth Debug Info:');
                    console.log('Client ID:', clientId);
                    console.log('Redirect URI (raw):', process.env.REACT_APP_PIPEDRIVE_REDIRECT_URI || `${window.location.origin}/onboarding`);
                    console.log('Redirect URI (encoded):', redirectUri);
                    console.log('Full OAuth URL:', authUrl);
                    
                    if (!clientId) {
                      alert('❌ Missing REACT_APP_PIPEDRIVE_CLIENT_ID environment variable');
                      return;
                    }
                    
                    // Redirect to Pipedrive OAuth
                    window.location.href = authUrl;
                  }}
                >
                  Connect Pipedrive Account
                </button>
              </div>
            </div>
          )}
          
          {isPipedriveConnected && (
            <div className="connection-info">
              <h4>What happens next:</h4>
              <ul>
                <li>We'll create webhook subscriptions in your Pipedrive account</li>
                <li>When events happen in Pipedrive, we'll receive them instantly</li>
                <li>Our system will format and route notifications to your Google Chat</li>
                <li>You maintain full control over which events trigger notifications</li>
              </ul>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'webhook',
      title: 'Add Your Google Chat Webhook 💬',
      description: 'Connect a Google Chat space to receive notifications',
      isCompleted: webhooks.length > 0,
      component: (
        <div className="webhook-step">
          {isCheckingWebhooks ? (
            <div className="checking-webhooks">
              <div className="connection-status checking">
                <div className="status-icon">🔄</div>
                <div className="status-content">
                  <h3>Checking Your Configuration...</h3>
                  <p>Looking for existing webhook settings...</p>
                </div>
              </div>
            </div>
          ) : webhooks.length > 0 ? (
            <div className="existing-webhooks">
              <div className="connection-status success">
                <div className="status-icon">✅</div>
                <div className="status-content">
                  <h3>Google Chat Already Connected!</h3>
                  <p>We found your existing configuration with {webhooks.length} webhook{webhooks.length > 1 ? 's' : ''}:</p>
                </div>
              </div>
              <div className="webhook-list">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="webhook-item">
                    <span className="webhook-name">{webhook.name}</span>
                    <span className="webhook-status active">Active</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="webhook-form">
              <div className="form-instructions">
                <h4>How to get your Google Chat webhook URL:</h4>
                <ol>
                  <li>Open Google Chat and go to the space where you want notifications</li>
                  <li>Click the space name → "Apps & integrations" → "Add webhooks"</li>
                  <li>Name it "Pipenotify" and copy the webhook URL</li>
                  <li>Paste the URL below</li>
                </ol>
              </div>
              
              <div className="form-fields">
                <div className="form-field">
                  <label>Webhook Name *</label>
                  <input
                    type="text"
                    value={webhookFormData.name}
                    onChange={(e) => setWebhookFormData({...webhookFormData, name: e.target.value})}
                    placeholder="e.g., Sales Team Notifications"
                  />
                </div>
                
                <div className="form-field">
                  <label>Google Chat Webhook URL *</label>
                  <input
                    type="url"
                    value={webhookFormData.webhook_url}
                    onChange={(e) => setWebhookFormData({...webhookFormData, webhook_url: e.target.value})}
                    placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."
                  />
                </div>
                
                <div className="form-field">
                  <label>Description (Optional)</label>
                  <input
                    type="text"
                    value={webhookFormData.description}
                    onChange={(e) => setWebhookFormData({...webhookFormData, description: e.target.value})}
                    placeholder="Notifications for sales team"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'rule',
      title: 'Create Your First Notification Rule ⚙️',
      description: 'Set up a rule to get notified about important events',
      isCompleted: false,
      component: (
        <div className="rule-step">
          <div className="rule-explanation">
            <h4>Let's create your first notification rule!</h4>
            <p>We'll start with a simple rule to notify you when deals are won - a great way to celebrate victories with your team.</p>
          </div>
          
          <div className="rule-form">
            <div className="form-field">
              <label>Rule Name</label>
              <input
                type="text"
                value={ruleFormData.name}
                onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                placeholder="My First Notification Rule"
              />
            </div>
            
            <div className="form-field">
              <label>When should this rule trigger?</label>
              <select
                value={ruleFormData.event_type}
                onChange={(e) => setRuleFormData({...ruleFormData, event_type: e.target.value})}
              >
                <option value="deal.won">🎉 When a deal is won</option>
                <option value="deal.added">🆕 When a deal is created</option>
                <option value="deal.change">📝 When a deal is updated</option>
                <option value="activity.added">📞 When an activity is added</option>
              </select>
            </div>
            
            <div className="form-field">
              <label>Send notifications to</label>
              <select
                value={ruleFormData.target_webhook_id}
                onChange={(e) => setRuleFormData({...ruleFormData, target_webhook_id: e.target.value})}
              >
                <option value="">Select a webhook...</option>
                {webhooks.map(webhook => (
                  <option key={webhook.id} value={webhook.id}>
                    {webhook.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-field">
              <label>Message Style</label>
              <div className="template-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="template_mode"
                    value="simple"
                    checked={ruleFormData.template_mode === 'simple'}
                    onChange={(e) => setRuleFormData({...ruleFormData, template_mode: e.target.value})}
                  />
                  <span>Simple - Clean and concise</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="template_mode"
                    value="detailed"
                    checked={ruleFormData.template_mode === 'detailed'}
                    onChange={(e) => setRuleFormData({...ruleFormData, template_mode: e.target.value})}
                  />
                  <span>Detailed - Rich information</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="rule-preview">
            <h5>Preview ({ruleFormData.template_mode}):</h5>
            <div className="preview-message">
              {ruleFormData.template_mode === 'simple' ? (
                // Simple template previews
                ruleFormData.event_type === 'deal.won' ? (
                  <>🎉 <strong>Deal Won!</strong><br/>
                  "Example Deal" ($5,000) won by John Doe</>
                ) : ruleFormData.event_type === 'deal.added' ? (
                  <>🆕 <strong>New Deal</strong><br/>
                  "Example Deal" ($5,000) created by John Doe</>
                ) : ruleFormData.event_type === 'deal.change' ? (
                  <>📝 <strong>Deal Updated</strong><br/>
                  "Example Deal" updated by John Doe</>
                ) : (
                  <>📞 <strong>Activity Added</strong><br/>
                  "Follow-up call" scheduled by John Doe</>
                )
              ) : (
                // Detailed template previews
                ruleFormData.event_type === 'deal.won' ? (
                  <>🎉 <strong>Deal Won!</strong><br/>
                  <strong>Deal:</strong> "Example Deal"<br/>
                  <strong>Value:</strong> $5,000<br/>
                  <strong>Owner:</strong> John Doe<br/>
                  <strong>Pipeline:</strong> Sales Pipeline<br/>
                  <strong>Won Date:</strong> {new Date().toLocaleDateString()}</>
                ) : ruleFormData.event_type === 'deal.added' ? (
                  <>🆕 <strong>New Deal Created</strong><br/>
                  <strong>Deal:</strong> "Example Deal"<br/>
                  <strong>Value:</strong> $5,000<br/>
                  <strong>Owner:</strong> John Doe<br/>
                  <strong>Pipeline:</strong> Sales Pipeline<br/>
                  <strong>Stage:</strong> Qualified<br/>
                  <strong>Created:</strong> {new Date().toLocaleDateString()}</>
                ) : ruleFormData.event_type === 'deal.change' ? (
                  <>📝 <strong>Deal Updated</strong><br/>
                  <strong>Deal:</strong> "Example Deal"<br/>
                  <strong>Value:</strong> $5,000 → $7,500<br/>
                  <strong>Owner:</strong> John Doe<br/>
                  <strong>Stage:</strong> Qualified → Proposal Made<br/>
                  <strong>Updated:</strong> {new Date().toLocaleDateString()}</>
                ) : (
                  <>📞 <strong>Activity Added</strong><br/>
                  <strong>Activity:</strong> "Follow-up call"<br/>
                  <strong>Deal:</strong> "Example Deal" ($5,000)<br/>
                  <strong>Owner:</strong> John Doe<br/>
                  <strong>Due Date:</strong> {new Date(Date.now() + 86400000).toLocaleDateString()}<br/>
                  <strong>Added:</strong> {new Date().toLocaleDateString()}</>
                )
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'test',
      title: 'Test Your Setup 🧪',
      description: 'Send a test notification to make sure everything works',
      isCompleted: false,
      component: (
        <div className="test-step">
          <div className="test-explanation">
            <h4>Let's test your setup!</h4>
            <p>We'll send a test notification to your Google Chat to make sure everything is working correctly.</p>
          </div>
          
          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              <div className="result-icon">
                {testResult.success ? '✅' : '❌'}
              </div>
              <div className="result-message">{testResult.message}</div>
            </div>
          )}
          
          <div className="test-actions">
            <button 
              className="test-button"
              onClick={testNotification}
              disabled={isLoading || !ruleFormData.target_webhook_id}
            >
              {isLoading ? '⏳ Sending...' : '🚀 Send Test Notification'}
            </button>
          </div>
          
          <div className="test-info">
            <h5>What happens when you click test:</h5>
            <ul>
              <li>A test message will be sent to your selected Google Chat space</li>
              <li>You should see it appear within a few seconds</li>
              <li>This confirms your webhook URL is working correctly</li>
              <li>Real notifications will look similar but with actual Pipedrive data</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'success',
      title: 'All Set! 🎊',
      description: 'Your Pipenotify integration is ready to go',
      isCompleted: false,
      component: (
        <div className="success-step">
          <div className="success-hero">
            <div className="success-icon">🎊</div>
            <h2>Congratulations!</h2>
            <p>Your Pipenotify integration is now active and ready to keep your team informed about important Pipedrive events.</p>
          </div>
          
          <div className="next-steps">
            <h4>What's Next?</h4>
            <div className="next-actions">
              <div className="action-card">
                <div className="action-icon">🎯</div>
                <h5>Smart Channel Routing</h5>
                <p>Set up automatic routing to send different types of notifications to specific channels</p>
              </div>
              <div className="action-card">
                <div className="action-icon">🔕</div>
                <h5>Configure Quiet Hours</h5>
                <p>Set up quiet periods to avoid notifications during off-hours and weekends</p>
              </div>
              <div className="action-card">
                <div className="action-icon">📊</div>
                <h5>Create More Rules</h5>
                <p>Add more notification rules for different events and customize message templates</p>
              </div>
              <div className="action-card">
                <div className="action-icon">🔧</div>
                <h5>Advanced Filters</h5>
                <p>Use filters to only get notified about deals above certain values or specific pipelines</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Filter out the rule step from the steps array
  const steps = allSteps.filter(step => step.id !== 'rule');

  const nextStep = async () => {
    const current = steps[currentStep];
    
    // Handle step-specific actions
    if (current.id === 'webhook' && webhooks.length === 0) {
      const success = await createWebhook();
      if (!success) return;
      // After creating webhook, automatically create default rules
      await createDefaultRules();
    }
    
    setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
  };

  const prevStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  const canProceed = () => {
    const current = steps[currentStep];
    
    switch (current.id) {
      case 'welcome':
        return true; // Welcome step can always proceed
      case 'pipedrive':
        // Only allow proceeding if Pipedrive is properly connected
        return isPipedriveConnected;
      case 'webhook':
        return webhooks.length > 0 || (webhookFormData.name && webhookFormData.webhook_url);
      case 'test':
        return testResult?.success || false; // Must pass test to proceed
      // Skip rule validation since we auto-create default rules
      default:
        return true;
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="onboarding-wizard">
      <div className="wizard-header">
        <div className="wizard-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
          <div className="progress-text">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
        
        <button className="skip-button" onClick={onSkip}>
          Skip Setup
        </button>
      </div>

      <div className="wizard-content">
        <div className="step-header">
          <h1>{currentStepData.title}</h1>
          <p>{currentStepData.description}</p>
        </div>

        <div className="step-content">
          {currentStepData.component}
        </div>
      </div>

      <div className="wizard-footer">
        <div className="step-navigation">
          <button 
            className="nav-button prev"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>
          
          <div className="step-indicators">
            {steps.map((_, index) => (
              <div 
                key={index} 
                className={`step-indicator ${index <= currentStep ? 'completed' : ''}`}
              />
            ))}
          </div>
          
          {currentStep === steps.length - 1 ? (
            <button className="nav-button next complete" onClick={onComplete}>
              Complete Setup →
            </button>
          ) : (
            <button 
              className="nav-button next"
              onClick={nextStep}
              disabled={!canProceed() || isLoading}
            >
              {isLoading ? '⏳ Loading...' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;