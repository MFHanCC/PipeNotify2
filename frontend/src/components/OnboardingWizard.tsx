import React, { useState, useEffect } from 'react';
import './OnboardingWizard.css';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  isValid: boolean;
  isValidating: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  eventType: string;
  previewUrl: string;
  modes: {
    compact: boolean;
    detailed: boolean;
  };
}

interface FilterRule {
  pipeline?: string;
  stage?: string;
  owner?: string;
  minValue?: number;
  targetWebhookId?: string;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
}

const OnboardingWizard: React.FC = () => {
  // State management for wizard steps
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth and connection state
  const [pipedriveConnected, setPipedriveConnected] = useState(false);
  const [pipedriveCompany, setPipedriveCompany] = useState<string>('');
  const [oauthToken, setOauthToken] = useState<string>('');

  // Google Chat webhook configuration
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '' });

  // Template selection
  const [availableTemplates] = useState<NotificationTemplate[]>([
    {
      id: 'deal-won',
      name: 'Deal Won',
      description: 'Notify when deals are marked as won',
      eventType: 'deal.won',
      previewUrl: '/api/preview/deal-won',
      modes: { compact: true, detailed: true }
    },
    {
      id: 'deal-stage-changed',
      name: 'Deal Stage Changed',
      description: 'Notify when deal moves between stages',
      eventType: 'deal.stage_changed',
      previewUrl: '/api/preview/deal-stage-changed',
      modes: { compact: true, detailed: true }
    },
    {
      id: 'activity-assigned',
      name: 'Activity Assigned',
      description: 'Notify when activities are assigned',
      eventType: 'activity.assigned',
      previewUrl: '/api/preview/activity-assigned',
      modes: { compact: true, detailed: true }
    },
    {
      id: 'activity-overdue',
      name: 'Activity Overdue',
      description: 'Notify when activities become overdue',
      eventType: 'activity.overdue',
      previewUrl: '/api/preview/activity-overdue',
      modes: { compact: true, detailed: true }
    },
    {
      id: 'new-lead',
      name: 'New Lead Created',
      description: 'Notify when new leads are added',
      eventType: 'lead.created',
      previewUrl: '/api/preview/new-lead',
      modes: { compact: true, detailed: true }
    },
    {
      id: 'new-person',
      name: 'New Person Added',
      description: 'Notify when new contacts are created',
      eventType: 'person.created',
      previewUrl: '/api/preview/new-person',
      modes: { compact: true, detailed: true }
    }
  ]);

  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [templateModes, setTemplateModes] = useState<Record<string, 'compact' | 'detailed'>>({});

  // Rule configuration
  const [rules, setRules] = useState<Array<{
    templateId: string;
    filters: FilterRule;
    webhookId: string;
  }>>([]);

  // Test results
  const [testResults, setTestResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({});

  // Wizard steps configuration
  const steps: OnboardingStep[] = [
    { id: 1, title: 'Welcome & Account Verification', description: 'Confirm your Pipedrive connection', isComplete: pipedriveConnected },
    { id: 2, title: 'Google Chat Configuration', description: 'Add your Chat webhook URLs', isComplete: webhooks.length > 0 && webhooks.every(w => w.isValid) },
    { id: 3, title: 'Template Selection', description: 'Choose notification templates', isComplete: selectedTemplates.size > 0 },
    { id: 4, title: 'Rule Configuration', description: 'Set up filtering and routing', isComplete: rules.length > 0 },
    { id: 5, title: 'Testing & Activation', description: 'Test and activate notifications', isComplete: false }
  ];

  // OAuth flow initialization
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`OAuth error: ${error}`);
      return;
    }

    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      setOauthToken(data.token);
      setPipedriveConnected(true);
      setPipedriveCompany(data.user.company);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const initiatePipedriveOAuth = () => {
    const clientId = process.env.REACT_APP_PIPEDRIVE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/onboarding`;
    const state = Math.random().toString(36).substring(2, 15);
    
    // Store state for CSRF protection
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `https://oauth.pipedrive.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `state=${state}&` +
      `scope=deals:read+activities:read+leads:read+users:read+webhooks:full`;

    window.location.href = authUrl;
  };

  const addWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url) {
      setError('Please provide both webhook name and URL');
      return;
    }

    const webhookId = Math.random().toString(36).substring(2, 15);
    const webhook: WebhookConfig = {
      id: webhookId,
      name: newWebhook.name,
      url: newWebhook.url,
      isValid: false,
      isValidating: true,
    };

    const newWebhooksList = [...webhooks, webhook];
    setWebhooks(newWebhooksList);
    setNewWebhook({ name: '', url: '' });

    // Validate webhook
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/webhooks/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`,
        },
        body: JSON.stringify({ url: webhook.url }),
      });

      const updatedWebhooks = newWebhooksList.map(w => 
        w.id === webhookId 
          ? { ...w, isValid: response.ok, isValidating: false }
          : w
      );
      setWebhooks(updatedWebhooks);

      if (!response.ok) {
        setError('Webhook validation failed. Please check the URL and permissions.');
      }
    } catch (err) {
      const updatedWebhooks = newWebhooksList.map(w => 
        w.id === webhookId 
          ? { ...w, isValid: false, isValidating: false }
          : w
      );
      setWebhooks(updatedWebhooks);
      setError('Failed to validate webhook. Please try again.');
    }
  };

  const removeWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
  };

  const toggleTemplate = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
      const newModes = { ...templateModes };
      delete newModes[templateId];
      setTemplateModes(newModes);
    } else {
      newSelected.add(templateId);
      setTemplateModes({
        ...templateModes,
        [templateId]: 'compact'
      });
    }
    setSelectedTemplates(newSelected);
    
    // Auto-generate default rules when templates change
    generateDefaultRules(newSelected);
  };

  const setTemplateMode = (templateId: string, mode: 'compact' | 'detailed') => {
    setTemplateModes({
      ...templateModes,
      [templateId]: mode
    });
  };

  const generateDefaultRules = (selectedTemplateIds: Set<string>) => {
    // Get the first valid webhook as default target
    const defaultWebhook = webhooks.find(w => w.isValid);
    if (!defaultWebhook || selectedTemplateIds.size === 0) {
      setRules([]);
      return;
    }

    const defaultRules = Array.from(selectedTemplateIds).map(templateId => ({
      templateId,
      filters: {
        pipeline: '', // All pipelines
        stage: '',    // All stages
        owner: '',    // All owners
        minValue: 0,  // No minimum value
        targetWebhookId: defaultWebhook.id
      },
      webhookId: defaultWebhook.id
    }));

    setRules(defaultRules);
  };

  const updateRuleFilter = (templateId: string, filterKey: keyof FilterRule, value: any) => {
    setRules(rules.map(rule => 
      rule.templateId === templateId 
        ? { ...rule, filters: { ...rule.filters, [filterKey]: value } }
        : rule
    ));
  };

  const testAllRules = async () => {
    setIsLoading(true);
    const newTestResults: Record<string, 'pending' | 'success' | 'error'> = {};
    
    for (const rule of rules) {
      newTestResults[`${rule.templateId}-${rule.webhookId}`] = 'pending';
    }
    setTestResults(newTestResults);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      for (const rule of rules) {
        const ruleKey = `${rule.templateId}-${rule.webhookId}`;
        
        try {
          const response = await fetch(`${apiUrl}/api/v1/test/notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${oauthToken}`,
            },
            body: JSON.stringify({
              templateId: rule.templateId,
              webhookId: rule.webhookId,
              filters: rule.filters,
            }),
          });

          newTestResults[ruleKey] = response.ok ? 'success' : 'error';
        } catch (err) {
          newTestResults[ruleKey] = 'error';
        }
        
        setTestResults({ ...newTestResults });
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
    } catch (err) {
      setError('Test failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateIntegration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/integration/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`,
        },
        body: JSON.stringify({
          webhooks: webhooks,
          templates: Array.from(selectedTemplates).map(id => ({
            id,
            mode: templateModes[id]
          })),
          rules: rules,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to activate integration');
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      // Generate default rules when entering step 4
      if (currentStep === 3) {
        generateDefaultRules(selectedTemplates);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h2>Welcome to Pipedrive → Google Chat Integration</h2>
            <p>Connect your Pipedrive account to get started with real-time notifications in Google Chat.</p>
            
            {!pipedriveConnected ? (
              <div className="oauth-section">
                <p>Click below to securely connect your Pipedrive account:</p>
                <button 
                  className="oauth-button primary"
                  onClick={initiatePipedriveOAuth}
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Connect Pipedrive Account'}
                </button>
              </div>
            ) : (
              <div className="connection-success">
                <div className="success-icon">✅</div>
                <h3>Successfully Connected!</h3>
                <p><strong>Company:</strong> {pipedriveCompany}</p>
                <p>Your Pipedrive account is now connected and ready for integration.</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h2>Google Chat Configuration</h2>
            <p>Add your Google Chat webhook URLs to receive notifications.</p>
            
            <div className="webhook-form">
              <div className="form-group">
                <label htmlFor="webhook-name">Space Name</label>
                <input
                  id="webhook-name"
                  type="text"
                  placeholder="e.g., Sales Team, Deal Alerts"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="webhook-url">Webhook URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  placeholder="https://chat.googleapis.com/v1/spaces/..."
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
              </div>
              
              <button 
                className="add-webhook-button"
                onClick={addWebhook}
                disabled={!newWebhook.name || !newWebhook.url || isLoading}
              >
                Add Webhook
              </button>
            </div>

            <div className="webhooks-list">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="webhook-item">
                  <div className="webhook-info">
                    <strong>{webhook.name}</strong>
                    <span className="webhook-url">{webhook.url}</span>
                  </div>
                  <div className="webhook-status">
                    {webhook.isValidating ? (
                      <span className="validating">Validating...</span>
                    ) : webhook.isValid ? (
                      <span className="valid">✅ Valid</span>
                    ) : (
                      <span className="invalid">❌ Invalid</span>
                    )}
                    <button 
                      className="remove-button"
                      onClick={() => removeWebhook(webhook.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h2>Notification Templates</h2>
            <p>Choose which events you want to receive notifications for.</p>
            
            <div className="templates-grid">
              {availableTemplates.map((template) => (
                <div 
                  key={template.id} 
                  className={`template-card ${selectedTemplates.has(template.id) ? 'selected' : ''}`}
                >
                  <div className="template-header">
                    <input
                      type="checkbox"
                      checked={selectedTemplates.has(template.id)}
                      onChange={() => toggleTemplate(template.id)}
                    />
                    <h3>{template.name}</h3>
                  </div>
                  <p>{template.description}</p>
                  
                  {selectedTemplates.has(template.id) && (
                    <div className="template-modes">
                      <label>
                        <input
                          type="radio"
                          name={`mode-${template.id}`}
                          value="compact"
                          checked={templateModes[template.id] === 'compact'}
                          onChange={() => setTemplateMode(template.id, 'compact')}
                        />
                        Compact
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`mode-${template.id}`}
                          value="detailed"
                          checked={templateModes[template.id] === 'detailed'}
                          onChange={() => setTemplateMode(template.id, 'detailed')}
                        />
                        Detailed
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h2>Rule Configuration</h2>
            <p>Configure filters and routing for each selected template.</p>
            
            <div className="rules-configuration">
              {Array.from(selectedTemplates).map((templateId) => {
                const template = availableTemplates.find(t => t.id === templateId);
                const rule = rules.find(r => r.templateId === templateId);
                if (!template || !rule) return null;

                return (
                  <div key={templateId} className="rule-config-card">
                    <h3>{template.name}</h3>
                    <p className="rule-status">✅ Default configuration applied - customize if needed</p>
                    <div className="rule-filters">
                      <div className="filter-group">
                        <label>Pipeline</label>
                        <select 
                          value={rule.filters.pipeline || ""}
                          onChange={(e) => updateRuleFilter(templateId, 'pipeline', e.target.value)}
                        >
                          <option value="">All Pipelines (Default)</option>
                          <option value="sales">Sales Pipeline</option>
                          <option value="marketing">Marketing Pipeline</option>
                        </select>
                      </div>
                      
                      <div className="filter-group">
                        <label>Stage</label>
                        <select 
                          value={rule.filters.stage || ""}
                          onChange={(e) => updateRuleFilter(templateId, 'stage', e.target.value)}
                        >
                          <option value="">All Stages (Default)</option>
                          <option value="qualified">Qualified</option>
                          <option value="proposal">Proposal</option>
                          <option value="negotiation">Negotiation</option>
                        </select>
                      </div>
                      
                      <div className="filter-group">
                        <label>Minimum Deal Value</label>
                        <input 
                          type="number" 
                          placeholder="0" 
                          min="0"
                          value={rule.filters.minValue || 0}
                          onChange={(e) => updateRuleFilter(templateId, 'minValue', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="filter-group">
                        <label>Target Chat Space</label>
                        <select 
                          value={rule.webhookId}
                          onChange={(e) => updateRuleFilter(templateId, 'targetWebhookId', e.target.value)}
                        >
                          {webhooks.filter(w => w.isValid).map(webhook => (
                            <option key={webhook.id} value={webhook.id}>
                              {webhook.name} {webhook.id === rule.webhookId ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {selectedTemplates.size > 0 && rules.length > 0 && (
                <div className="default-config-notice">
                  <p>ℹ️ <strong>Default Configuration Applied:</strong> All selected templates will notify your first Google Chat space for any pipeline activity. You can customize these settings above or proceed with defaults.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <h2>Testing & Activation</h2>
            <p>Test your configuration before going live.</p>
            
            <div className="test-section">
              <button 
                className="test-button primary"
                onClick={testAllRules}
                disabled={isLoading || rules.length === 0}
              >
                {isLoading ? 'Testing...' : 'Test All Rules'}
              </button>
              
              <div className="test-results">
                {Object.entries(testResults).map(([ruleKey, status]) => (
                  <div key={ruleKey} className={`test-result ${status}`}>
                    <span className="rule-name">{ruleKey}</span>
                    <span className="status">
                      {status === 'pending' && '⏳ Testing...'}
                      {status === 'success' && '✅ Success'}
                      {status === 'error' && '❌ Failed'}
                    </span>
                  </div>
                ))}
              </div>
              
              {Object.values(testResults).every(status => status === 'success') && (
                <div className="activation-section">
                  <h3>Ready to Activate!</h3>
                  <p>All tests passed. Click below to activate your integration.</p>
                  <button 
                    className="activate-button success"
                    onClick={activateIntegration}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Activating...' : 'Activate Integration'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-wizard">
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="wizard-header">
        <div className="progress-bar">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`progress-step ${currentStep === step.id ? 'active' : ''} ${step.isComplete ? 'complete' : ''}`}
            >
              <div className="step-number">
                {step.isComplete ? '✓' : step.id}
              </div>
              <div className="step-info">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="wizard-content">
        {renderStepContent()}
      </div>
      
      <div className="wizard-footer">
        {currentStep > 1 && (
          <button 
            className="nav-button secondary"
            onClick={prevStep}
            disabled={isLoading}
          >
            Previous
          </button>
        )}
        
        {currentStep < steps.length && (
          <button 
            className="nav-button primary"
            onClick={nextStep}
            disabled={!steps[currentStep - 1].isComplete || isLoading}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;