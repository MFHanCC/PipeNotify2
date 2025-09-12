import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
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
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    description: ''
  });

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
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Webhook'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showAddForm && (
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
                  className="btn-test"
                  onClick={() => handleTestWebhook(webhook.id)}
                  disabled={testingId === webhook.id}
                >
                  {testingId === webhook.id ? (
                    <>
                      <span className="spinner"></span>
                      Testing...
                    </>
                  ) : (
                    '🧪 Test'
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