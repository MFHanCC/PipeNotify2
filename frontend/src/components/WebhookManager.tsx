import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/api';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import './WebhookManager.css';

interface Webhook {
  id: string;
  name: string;
  webhook_url: string;
  description?: string;
}

interface WebhookManagerProps {
  onWebhooksChange?: (webhooks: Webhook[]) => void;
}

const WebhookManager: React.FC<WebhookManagerProps> = ({ onWebhooksChange }) => {
  const { planTier, limits, loading: featuresLoading } = usePlanFeatures();
  
  // Helper to check if webhook limit is unlimited or within bounds
  const isWithinWebhookLimit = (currentCount: number) => {
    const webhookLimit = limits?.webhooks || 1;
    // -1 means unlimited, 999+ means unlimited (treat as unlimited)
    return webhookLimit === -1 || webhookLimit >= 999 || currentCount < webhookLimit;
  };
  
  const getWebhookLimitMessage = () => {
    const webhookLimit = limits?.webhooks || 1;
    if (webhookLimit === -1 || webhookLimit >= 999) {
      return 'unlimited';
    }
    return webhookLimit.toString();
  };
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    description: ''
  });

  // Enhanced error handling
  const handleApiError = useCallback((error: any, operation: string) => {
    let message = `Failed to ${operation}`;
    if (error?.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error?.status === 403) {
      message = 'Permission denied.';
    } else if (error?.message) {
      message = error.message;
    }
    setError(message);
  }, []);

  // Form validation
  const formValidation = useMemo(() => {
    const errors: {[key: string]: string} = {};
    
    if (!newWebhook.name.trim()) {
      errors.name = 'Webhook name is required';
    }
    
    if (!newWebhook.webhook_url.trim()) {
      errors.webhook_url = 'Webhook URL is required';
    } else if (!newWebhook.webhook_url.includes('chat.googleapis.com')) {
      errors.webhook_url = 'Please enter a valid Google Chat webhook URL';
    } else if (!newWebhook.webhook_url.startsWith('https://')) {
      errors.webhook_url = 'Webhook URL must start with https://';
    }
    
    return errors;
  }, [newWebhook]);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getWebhooks();
      setWebhooks(data);
      if (onWebhooksChange) {
        onWebhooksChange(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check webhook limit based on plan
    if (!isWithinWebhookLimit(webhooks.length)) {
      const planName = planTier === 'free' ? 'Free' : planTier === 'starter' ? 'Starter' : planTier === 'pro' ? 'Pro' : 'Team';
      const webhookLimit = limits?.webhooks || 1;
      setError(`${planName} plan allows maximum ${webhookLimit} webhook${webhookLimit > 1 ? 's' : ''}. ${webhookLimit === 1 ? 'Delete the existing webhook first or ' : ''}Upgrade your plan to add more webhooks.`);
      return;
    }
    
    if (!newWebhook.name.trim() || !newWebhook.webhook_url.trim()) {
      setError('Name and webhook URL are required');
      return;
    }

    if (!newWebhook.webhook_url.includes('chat.googleapis.com')) {
      setError('Please enter a valid Google Chat webhook URL');
      return;
    }

    try {
      setError(null);
      await apiService.createWebhook(newWebhook);
      setNewWebhook({ name: '', webhook_url: '', description: '' });
      setShowAddForm(false);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      setTestingId(webhookId);
      setError(null);
      
      const result = await apiService.testWebhook(webhookId);
      
      if (result.success) {
        alert('✅ Test message sent successfully! Check your Google Chat.');
      } else {
        setError('Test failed: ' + result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test webhook');
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteWebhook = async (webhookId: string, webhookName: string) => {
    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete the webhook "${webhookName}"?\n\nThis action cannot be undone. Any rules using this webhook will need to be updated.`)) {
      return;
    }

    try {
      setDeletingId(webhookId);
      setError(null);
      
      const result = await apiService.deleteWebhook(webhookId);
      
      if (result.success) {
        await loadWebhooks(); // Refresh the list
        alert('✅ Webhook deleted successfully!');
      } else {
        setError('Delete failed: ' + result.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete webhook';
      setError(errorMessage);
      
      // Show more user-friendly error messages
      if (errorMessage.includes('active rules')) {
        alert('❌ Cannot delete webhook because it is being used by active rules. Please disable or delete those rules first.');
      } else {
        alert('❌ Failed to delete webhook: ' + errorMessage);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const validateWebhookUrl = (url: string) => {
    if (!url) return '';
    if (!url.includes('chat.googleapis.com')) {
      return 'Must be a Google Chat webhook URL';
    }
    if (!url.startsWith('https://')) {
      return 'URL must start with https://';
    }
    return '';
  };

  const webhookUrlError = validateWebhookUrl(newWebhook.webhook_url);

  if (isLoading) {
    return (
      <div className="webhook-manager">
        <div className="loading">Loading webhooks...</div>
      </div>
    );
  }

  return (
    <div className="webhook-manager">
      <div className="webhook-manager-header">
        <h3>Google Chat Webhooks</h3>
        <button 
          className="btn-primary"
          onClick={() => {
            if (!showAddForm && !isWithinWebhookLimit(webhooks.length)) {
              return; // Don't show form if at limit
            }
            setShowAddForm(!showAddForm);
          }}
          disabled={featuresLoading || (!showAddForm && !isWithinWebhookLimit(webhooks.length))}
          title={!isWithinWebhookLimit(webhooks.length)
            ? `${planTier === 'free' ? 'Free' : planTier} plan limit reached (${getWebhookLimitMessage()} webhook${getWebhookLimitMessage() === '1' ? '' : 's'} max). Upgrade to add more webhooks.`
            : 'Add a new Google Chat webhook'
          }
        >
          {showAddForm ? 'Cancel' : '+ Add Webhook'}
          {!showAddForm && !isWithinWebhookLimit(webhooks.length) && (
            <span style={{marginLeft: '4px', opacity: 0.7}}>({webhooks.length}/{getWebhookLimitMessage()})</span>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!isWithinWebhookLimit(webhooks.length) && (
        <div className="error-message">
          ⚠️ You have {webhooks.length} webhooks but your {planTier} plan only allows {getWebhookLimitMessage()}. 
          {getWebhookLimitMessage() !== 'unlimited' && (
            <>Please delete {webhooks.length - (limits?.webhooks || 1)} webhook{webhooks.length - (limits?.webhooks || 1) > 1 ? 's' : ''} or upgrade your plan.</>
          )}
        </div>
      )}

      {showAddForm && isWithinWebhookLimit(webhooks.length) && (
        <div className="webhook-form">
          <h4>Add New Google Chat Webhook</h4>
          <form onSubmit={handleAddWebhook}>
            <div className="form-group">
              <label htmlFor="webhook-name">Name *</label>
              <input
                id="webhook-name"
                type="text"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                placeholder="e.g., Sales Team, Deal Alerts"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="webhook-url">Google Chat Webhook URL *</label>
              <input
                id="webhook-url"
                type="url"
                value={newWebhook.webhook_url}
                onChange={(e) => setNewWebhook({ ...newWebhook, webhook_url: e.target.value })}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                required
              />
              {webhookUrlError && (
                <div className="field-error">{webhookUrlError}</div>
              )}
              <div className="field-help">
                <a 
                  href="https://developers.google.com/chat/how-tos/webhooks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  How to create a Google Chat webhook →
                </a>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="webhook-description">Description</label>
              <input
                id="webhook-description"
                type="text"
                value={newWebhook.description}
                onChange={(e) => setNewWebhook({ ...newWebhook, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={!!webhookUrlError}>
                Add Webhook
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="webhooks-list">
        {webhooks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔗</div>
            <h4>No webhooks configured</h4>
            <p>Add a Google Chat webhook to start receiving notifications</p>
            <button className="btn-primary" onClick={() => setShowAddForm(true)}>
              Add Your First Webhook
            </button>
          </div>
        ) : (
          webhooks.map((webhook) => (
            <div key={webhook.id} className="webhook-item">
              <div className="webhook-info">
                <h4>{webhook.name}</h4>
                {webhook.description && (
                  <p className="webhook-description">{webhook.description}</p>
                )}
                <div className="webhook-url">
                  <span className="url-label">URL:</span>
                  <code className="webhook-url-text">
                    {webhook.webhook_url.substring(0, 50)}...
                  </code>
                </div>
              </div>
              
              <div className="webhook-actions">
                <button
                  className="action-button test-button"
                  onClick={() => handleTestWebhook(webhook.id)}
                  disabled={testingId === webhook.id || deletingId === webhook.id}
                  title={`Test webhook "${webhook.name}"`}
                >
                  {testingId === webhook.id ? (
                    <>
                      <span className="loading-spinner-inline"></span>
                      Testing
                    </>
                  ) : (
                    <>
                      <span className="button-icon">🧪</span>
                      Test
                    </>
                  )}
                </button>
                <button
                  className="action-button delete-button"
                  onClick={() => handleDeleteWebhook(webhook.id, webhook.name)}
                  disabled={testingId === webhook.id || deletingId === webhook.id}
                  title={`Delete webhook "${webhook.name}"`}
                >
                  {deletingId === webhook.id ? (
                    <>
                      <span className="loading-spinner-inline"></span>
                      Deleting
                    </>
                  ) : (
                    <>
                      <span className="button-icon">🗑️</span>
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {webhooks.length > 0 && (
        <div className="webhook-help">
          <h4>💡 Next Steps</h4>
          <ul>
            <li>Test each webhook to ensure they work correctly</li>
            <li>Create notification rules to route events to specific channels</li>
            <li>Use descriptive names to easily identify which channel notifications go to</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default WebhookManager;