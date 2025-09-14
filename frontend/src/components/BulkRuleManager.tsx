import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './BulkRuleManager.css';
import { authenticatedFetch } from '../utils/auth';

interface Rule {
  id: number;
  name: string;
  event_filters: any;
  message_template: string;
  target_webhook_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Webhook {
  id: number;
  name: string;
  webhook_url: string;
  is_active: boolean;
}

interface BulkOperation {
  type: 'activate' | 'deactivate' | 'delete' | 'update_webhook';
  rule_ids: number[];
  data?: any;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  imported_rules: Rule[];
}

interface BulkRuleManagerProps {
  onRefresh?: () => void;
}

const BulkRuleManager: React.FC<BulkRuleManagerProps> = ({ onRefresh }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedRules, setSelectedRules] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Filtered and searched rules
  const filteredRules = useMemo(() => {
    let filtered = rules;
    
    // Apply active filter
    if (filterActive !== 'all') {
      filtered = filtered.filter(rule => 
        filterActive === 'active' ? rule.is_active : !rule.is_active
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule =>
        rule.name.toLowerCase().includes(query) ||
        JSON.stringify(rule.event_filters).toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [rules, filterActive, searchQuery]);

  // Selection helpers
  const allSelectedOnPage = useMemo(() => 
    filteredRules.length > 0 && filteredRules.every(rule => selectedRules.includes(rule.id)),
    [filteredRules, selectedRules]
  );

  const someSelectedOnPage = useMemo(() =>
    filteredRules.some(rule => selectedRules.includes(rule.id)),
    [filteredRules, selectedRules]
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      const [rulesResponse, webhooksResponse] = await Promise.all([
        authenticatedFetch(`${apiUrl}/api/v1/admin/rules`).catch(() => null),
        authenticatedFetch(`${apiUrl}/api/v1/admin/webhooks`).catch(() => null)
      ]);

      if (rulesResponse && rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData.rules || []);
      } else {
        setError('Failed to load rules. Please check your connection and try again.');
      }

      if (webhooksResponse && webhooksResponse.ok) {
        const webhooksData = await webhooksResponse.json();
        setWebhooks(webhooksData.webhooks || []);
      } else if (!webhooksResponse) {
        console.warn('Failed to load webhooks');
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load bulk management data. Please refresh the page.');
    }
    setIsLoading(false);
  };

  // Using memoized filteredRules from above

  const handleRuleSelect = (ruleId: number, selected: boolean) => {
    if (selected) {
      setSelectedRules(prev => [...prev, ruleId]);
    } else {
      setSelectedRules(prev => prev.filter(id => id !== ruleId));
    }
  };

  const handleSelectAll = () => {
    if (selectedRules.length === filteredRules.length) {
      setSelectedRules([]);
    } else {
      setSelectedRules(filteredRules.map(rule => rule.id));
    }
  };

  const executeBulkOperation = async (operation: BulkOperation) => {
    if (selectedRules.length === 0) {
      alert('Please select at least one rule');
      return;
    }

    try {
      setIsProcessing(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/bulk`, {
        method: 'POST',
        body: JSON.stringify(operation)
      });

      const result = await response.json();

      if (response.ok) {
        alert(` Successfully processed ${selectedRules.length} rules`);
        setSelectedRules([]);
        await loadData();
        if (onRefresh) onRefresh();
      } else {
        alert(`L Bulk operation failed: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error executing bulk operation:', error);
      alert('L Failed to execute bulk operation');
    }
    setIsProcessing(false);
  };

  const handleBulkActivate = () => {
    executeBulkOperation({
      type: 'activate',
      rule_ids: selectedRules
    });
  };

  const handleBulkDeactivate = () => {
    executeBulkOperation({
      type: 'deactivate',
      rule_ids: selectedRules
    });
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedRules.length} selected rules? This action cannot be undone.`)) {
      executeBulkOperation({
        type: 'delete',
        rule_ids: selectedRules
      });
    }
  };

  const handleBulkUpdateWebhook = (webhookId: number) => {
    if (window.confirm(`Update webhook for ${selectedRules.length} selected rules?`)) {
      executeBulkOperation({
        type: 'update_webhook',
        rule_ids: selectedRules,
        data: { webhook_id: webhookId }
      });
    }
  };

  const handleExportRules = () => {
    const exportData = {
      export_date: new Date().toISOString(),
      rules: selectedRules.length > 0 
        ? rules.filter(rule => selectedRules.includes(rule.id))
        : rules,
      webhooks: webhooks // Include webhooks for context
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipenotify-rules-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportRules = async (file: File) => {
    try {
      setIsProcessing(true);
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await authenticatedFetch(`${apiUrl}/api/v1/admin/rules/import`, {
        method: 'POST',
        body: JSON.stringify({
          rules: importData.rules || importData, // Support both formats
          webhooks: importData.webhooks || []
        })
      });

      const result = await response.json();

      if (response.ok) {
        setImportResults(result);
        setShowImportModal(true);
        await loadData();
        if (onRefresh) onRefresh();
      } else {
        alert(`L Import failed: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error importing rules:', error);
      alert('L Failed to import rules. Please check the file format.');
    }
    setIsProcessing(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportRules(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="bulk-loading">
        <div className="loading-spinner"></div>
        <p>Loading rules...</p>
      </div>
    );
  }

  return (
    <div className="bulk-rule-manager">
      <div className="bulk-header">
        <div className="header-content">
          <h2>Bulk Rule Management</h2>
          <p>Manage multiple rules at once and import/export configurations</p>
        </div>
        <div className="header-actions">
          <button onClick={handleExportRules} className="export-button">
            =� Export {selectedRules.length > 0 ? `${selectedRules.length} Selected` : 'All Rules'}
          </button>
          <button onClick={triggerFileInput} className="import-button" disabled={isProcessing}>
            =� Import Rules
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search rules by name or message template..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="filter-select"
          >
            <option value="all">All Rules</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        
        <div className="selection-info">
          {selectedRules.length > 0 ? (
            <span className="selected-count">
              {selectedRules.length} of {filteredRules.length} rules selected
            </span>
          ) : (
            <span className="total-count">
              {filteredRules.length} rules found
            </span>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRules.length > 0 && (
        <div className="bulk-actions">
          <div className="action-group">
            <h3>=� Bulk Actions ({selectedRules.length} selected)</h3>
            <div className="action-buttons">
              <button
                onClick={handleBulkActivate}
                disabled={isProcessing}
                className="action-button activate"
              >
                 Activate
              </button>
              <button
                onClick={handleBulkDeactivate}
                disabled={isProcessing}
                className="action-button deactivate"
              >
                � Deactivate
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="action-button delete"
              >
                =� Delete
              </button>
            </div>
          </div>
          
          {webhooks.length > 0 && (
            <div className="webhook-update-group">
              <span>Update Webhook:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdateWebhook(parseInt(e.target.value));
                    e.target.value = '';
                  }
                }}
                disabled={isProcessing}
                className="webhook-select"
              >
                <option value="">Choose webhook...</option>
                {webhooks.map(webhook => (
                  <option key={webhook.id} value={webhook.id}>
                    {webhook.name} {webhook.is_active ? '' : 'L'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Rules Table */}
      <div className="rules-table-container">
        <table className="rules-table">
          <thead>
            <tr>
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={selectedRules.length === filteredRules.length && filteredRules.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Rule Name</th>
              <th>Status</th>
              <th>Event Filters</th>
              <th>Webhook</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map(rule => {
              const webhook = webhooks.find(w => w.id === rule.target_webhook_id);
              return (
                <tr key={rule.id} className={selectedRules.includes(rule.id) ? 'selected' : ''}>
                  <td className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedRules.includes(rule.id)}
                      onChange={(e) => handleRuleSelect(rule.id, e.target.checked)}
                    />
                  </td>
                  <td className="rule-name">
                    <div className="name-cell">
                      <strong>{rule.name}</strong>
                      <div className="message-preview">
                        {rule.message_template.substring(0, 60)}
                        {rule.message_template.length > 60 ? '...' : ''}
                      </div>
                    </div>
                  </td>
                  <td className={`status ${rule.is_active ? 'active' : 'inactive'}`}>
                    {rule.is_active ? ' Active' : '� Inactive'}
                  </td>
                  <td className="filters">
                    <div className="filters-summary">
                      {Object.entries(rule.event_filters || {}).map(([key, value]) => (
                        <span key={key} className="filter-tag">
                          {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="webhook">
                    {webhook ? (
                      <span className={webhook.is_active ? 'webhook-active' : 'webhook-inactive'}>
                        {webhook.name}
                      </span>
                    ) : (
                      <span className="webhook-missing">Missing</span>
                    )}
                  </td>
                  <td className="date">
                    {new Date(rule.created_at).toLocaleDateString()}
                  </td>
                  <td className="date">
                    {new Date(rule.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRules.length === 0 && (
          <div className="no-rules">
            <div className="no-rules-icon">=�</div>
            <h3>No rules found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Import Results Modal */}
      {showImportModal && importResults && (
        <div className="modal-overlay">
          <div className="import-modal">
            <div className="modal-header">
              <h3>Import Results</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="modal-close"
              >
                �
              </button>
            </div>
            <div className="modal-content">
              <div className="import-summary">
                <div className={`summary-stat ${importResults.success > 0 ? 'success' : ''}`}>
                  <span className="stat-number">{importResults.success}</span>
                  <span className="stat-label">Successfully Imported</span>
                </div>
                <div className={`summary-stat ${importResults.failed > 0 ? 'error' : ''}`}>
                  <span className="stat-number">{importResults.failed}</span>
                  <span className="stat-label">Failed</span>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="import-errors">
                  <h4>Errors:</h4>
                  <ul>
                    {importResults.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importResults.imported_rules.length > 0 && (
                <div className="imported-rules">
                  <h4>Imported Rules:</h4>
                  <ul>
                    {importResults.imported_rules.map((rule) => (
                      <li key={rule.id}>{rule.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowImportModal(false)}
                className="modal-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bulk-info">
        <h4>=� Bulk Management Tips</h4>
        <ul>
          <li><strong>Export:</strong> Download rules as JSON for backup or migration</li>
          <li><strong>Import:</strong> Upload previously exported rule configurations</li>
          <li><strong>Selection:</strong> Use search and filters to find specific rules quickly</li>
          <li><strong>Bulk Actions:</strong> Apply changes to multiple rules simultaneously</li>
          <li><strong>Webhook Updates:</strong> Reassign rules to different Google Chat channels</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkRuleManager;