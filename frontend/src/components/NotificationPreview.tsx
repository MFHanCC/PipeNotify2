import React, { useState, useEffect } from 'react';
import './NotificationPreview.css';
import { API_BASE_URL } from '../config/api';

interface Rule {
  id: number;
  name: string;
  event_filters: any;
  message_template: string;
  target_webhook_id: number;
  is_active: boolean;
}

interface Webhook {
  id: number;
  name: string;
  webhook_url: string;
  is_active: boolean;
}

interface TestEvent {
  event_type: string;
  object_type: string;
  object: any;
}

interface NotificationPreviewProps {
  onRefresh?: () => void;
}

const NotificationPreview: React.FC<NotificationPreviewProps> = ({ onRefresh }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [testEvent, setTestEvent] = useState<TestEvent>({
    event_type: 'added',
    object_type: 'deal',
    object: {}
  });
  const [previewMessage, setPreviewMessage] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [customEventData, setCustomEventData] = useState('');
  const [useCustomData, setUseCustomData] = useState(false);

  // Sample event data templates
  const eventTemplates = {
    'deal.added': {
      event_type: 'added',
      object_type: 'deal',
      object: {
        id: 123,
        title: 'New Enterprise Deal',
        value: 50000,
        currency: 'USD',
        status: 'open',
        stage_id: 2,
        person_name: 'John Doe',
        person_email: 'john@company.com',
        org_name: 'Acme Corporation',
        owner_name: 'Jane Smith',
        add_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      }
    },
    'deal.updated': {
      event_type: 'updated',
      object_type: 'deal',
      object: {
        id: 123,
        title: 'Enterprise Deal - Updated',
        value: 75000,
        currency: 'USD',
        status: 'won',
        stage_id: 5,
        person_name: 'John Doe',
        person_email: 'john@company.com',
        org_name: 'Acme Corporation',
        owner_name: 'Jane Smith',
        previous_value: 50000,
        previous_stage_id: 2,
        update_time: new Date().toISOString()
      }
    },
    'person.added': {
      event_type: 'added',
      object_type: 'person',
      object: {
        id: 456,
        name: 'Alice Johnson',
        email: 'alice@newcompany.com',
        phone: '+1-555-0123',
        org_name: 'NewCorp Inc',
        owner_name: 'Bob Wilson',
        add_time: new Date().toISOString()
      }
    },
    'activity.added': {
      event_type: 'added',
      object_type: 'activity',
      object: {
        id: 789,
        type: 'call',
        subject: 'Follow-up call with prospect',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        person_name: 'Sarah Connor',
        deal_title: 'Strategic Partnership',
        owner_name: 'Mike Davis',
        add_time: new Date().toISOString()
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRule && (testEvent || useCustomData)) {
      generatePreview();
    }
  }, [selectedRule, testEvent, customEventData, useCustomData]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [rulesResponse, webhooksResponse] = await Promise.all([
        fetch(`${apiUrl}/api/v1/admin/rules`, { headers }),
        fetch(`${apiUrl}/api/v1/admin/webhooks`, { headers })
      ]);

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData.rules || []);
        if (rulesData.rules?.length > 0) {
          setSelectedRule(rulesData.rules[0]);
        }
      }

      if (webhooksResponse.ok) {
        const webhooksData = await webhooksResponse.json();
        setWebhooks(webhooksData.webhooks || []);
        if (webhooksData.webhooks?.length > 0) {
          setSelectedWebhook(webhooksData.webhooks[0]);
        }
      }

    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const generatePreview = () => {
    if (!selectedRule) return;

    let eventData = testEvent;
    if (useCustomData && customEventData) {
      try {
        eventData = JSON.parse(customEventData);
      } catch (error) {
        setPreviewMessage('L Invalid JSON in custom event data');
        return;
      }
    }

    // Simple template replacement
    let message = selectedRule.message_template;
    
    // Replace template variables with event data
    const replaceVariables = (template: string, data: any, prefix = '') => {
      let result = template;
      
      Object.keys(data).forEach(key => {
        const value = data[key];
        const variableKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
          result = replaceVariables(result, value, variableKey);
        } else {
          const regex = new RegExp(`\\{\\{\\s*${variableKey}\\s*\\}\\}`, 'g');
          result = result.replace(regex, String(value || ''));
        }
      });
      
      return result;
    };

    message = replaceVariables(message, {
      event_type: eventData.event_type,
      object_type: eventData.object_type,
      object: eventData.object
    });

    // Clean up any unreplaced template variables
    message = message.replace(/\{\{\s*[^}]+\s*\}\}/g, '[missing data]');

    setPreviewMessage(message);
  };

  const handleTestNotification = async () => {
    if (!selectedRule || !selectedWebhook) {
      alert('Please select both a rule and a webhook');
      return;
    }

    try {
      setIsTesting(true);
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');

      let eventData = testEvent;
      if (useCustomData && customEventData) {
        try {
          eventData = JSON.parse(customEventData);
        } catch (error) {
          alert('L Invalid JSON in custom event data');
          return;
        }
      }

      const response = await fetch(`${apiUrl}/api/v1/admin/test/notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rule_id: selectedRule.id,
          webhook_id: selectedWebhook.id,
          test_event: eventData,
          message_override: previewMessage
        })
      });

      const result = await response.json();
      
      const testResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        rule_name: selectedRule.name,
        webhook_name: selectedWebhook.name,
        success: response.ok,
        message: previewMessage,
        response: result,
        event_type: `${eventData.object_type}.${eventData.event_type}`
      };

      setTestResults(prev => [testResult, ...prev.slice(0, 9)]); // Keep last 10 results

      if (response.ok) {
        alert(' Test notification sent successfully!');
      } else {
        alert(`L Test failed: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error testing notification:', error);
      alert('L Failed to send test notification');
    }
    setIsTesting(false);
  };

  const handleEventTemplateChange = (templateKey: string) => {
    if (templateKey === 'custom') {
      setUseCustomData(true);
      setCustomEventData(JSON.stringify(eventTemplates['deal.added'], null, 2));
    } else {
      setUseCustomData(false);
      setTestEvent(eventTemplates[templateKey as keyof typeof eventTemplates]);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  if (isLoading) {
    return (
      <div className="preview-loading">
        <div className="loading-spinner"></div>
        <p>Loading preview data...</p>
      </div>
    );
  }

  return (
    <div className="notification-preview">
      <div className="preview-header">
        <h2>Notification Preview & Testing</h2>
        <p>Test your rules and preview how notifications will appear in Google Chat</p>
      </div>

      <div className="preview-content">
        {/* Rule Selection */}
        <div className="preview-section">
          <h3>=� Select Rule</h3>
          <select
            value={selectedRule?.id || ''}
            onChange={(e) => {
              const rule = rules.find(r => r.id === parseInt(e.target.value));
              setSelectedRule(rule || null);
            }}
            className="rule-selector"
          >
            <option value="">Choose a rule...</option>
            {rules.map(rule => (
              <option key={rule.id} value={rule.id}>
                {rule.name} {rule.is_active ? '' : 'L'}
              </option>
            ))}
          </select>
          {selectedRule && (
            <div className="rule-details">
              <div className="detail-row">
                <strong>Status:</strong> {selectedRule.is_active ? 'Active' : 'Inactive'}
              </div>
              <div className="detail-row">
                <strong>Event Filters:</strong> {JSON.stringify(selectedRule.event_filters)}
              </div>
            </div>
          )}
        </div>

        {/* Webhook Selection */}
        <div className="preview-section">
          <h3>=� Select Webhook</h3>
          <select
            value={selectedWebhook?.id || ''}
            onChange={(e) => {
              const webhook = webhooks.find(w => w.id === parseInt(e.target.value));
              setSelectedWebhook(webhook || null);
            }}
            className="webhook-selector"
          >
            <option value="">Choose a webhook...</option>
            {webhooks.map(webhook => (
              <option key={webhook.id} value={webhook.id}>
                {webhook.name} {webhook.is_active ? '' : 'L'}
              </option>
            ))}
          </select>
        </div>

        {/* Event Data Selection */}
        <div className="preview-section">
          <h3>� Test Event Data</h3>
          <div className="event-selector">
            <select
              onChange={(e) => handleEventTemplateChange(e.target.value)}
              className="event-template-selector"
            >
              <option value="deal.added">Deal Added</option>
              <option value="deal.updated">Deal Updated</option>
              <option value="person.added">Person Added</option>
              <option value="activity.added">Activity Added</option>
              <option value="custom">Custom JSON</option>
            </select>
          </div>

          {useCustomData && (
            <div className="custom-event-data">
              <label>Custom Event JSON:</label>
              <textarea
                value={customEventData}
                onChange={(e) => setCustomEventData(e.target.value)}
                className="event-json-input"
                rows={10}
                placeholder="Enter custom event JSON..."
              />
            </div>
          )}

          {!useCustomData && (
            <div className="event-preview">
              <h4>Event Data Preview:</h4>
              <pre className="event-data">{JSON.stringify(testEvent, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Message Preview */}
        {selectedRule && (
          <div className="preview-section">
            <h3>=� Message Preview</h3>
            <div className="message-template">
              <h4>Template:</h4>
              <pre className="template-code">{selectedRule.message_template}</pre>
            </div>
            <div className="message-preview">
              <h4>Preview Output:</h4>
              <div className="preview-message">{previewMessage}</div>
            </div>
          </div>
        )}

        {/* Test Button */}
        <div className="test-section">
          <button
            onClick={handleTestNotification}
            disabled={!selectedRule || !selectedWebhook || isTesting}
            className="test-button"
          >
            {isTesting ? '� Testing...' : '>� Send Test Notification'}
          </button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="preview-section">
            <div className="results-header">
              <h3>=� Test Results</h3>
              <button onClick={clearTestResults} className="clear-button">
                Clear Results
              </button>
            </div>
            <div className="test-results">
              {testResults.map((result) => (
                <div key={result.id} className={`test-result ${result.success ? 'success' : 'error'}`}>
                  <div className="result-header">
                    <div className="result-status">
                      {result.success ? '' : 'L'} {result.timestamp}
                    </div>
                    <div className="result-info">
                      {result.rule_name} � {result.webhook_name}
                    </div>
                  </div>
                  <div className="result-details">
                    <div className="result-event-type">{result.event_type}</div>
                    <div className="result-message">{result.message}</div>
                    {result.response && (
                      <details className="result-response">
                        <summary>Response Details</summary>
                        <pre>{JSON.stringify(result.response, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="preview-info">
        <h4>=� Testing Tips</h4>
        <ul>
          <li><strong>Template Variables:</strong> Use <code>{'{{object.title}}'}</code> syntax to reference event data</li>
          <li><strong>Event Types:</strong> Test different Pipedrive events to ensure rule coverage</li>
          <li><strong>Custom Data:</strong> Use custom JSON to test edge cases and specific scenarios</li>
          <li><strong>Webhook Testing:</strong> Verify that webhooks are reachable and responding correctly</li>
          <li><strong>Rule Filters:</strong> Check that event data matches rule filter conditions</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationPreview;