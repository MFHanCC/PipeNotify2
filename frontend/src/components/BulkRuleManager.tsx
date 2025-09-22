import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';
import './BulkRuleManager.css';

interface Rule {
  id: string;
  name: string;
  message: string;
  isActive: boolean;
  filters: {
    pipeline_ids?: number[];
    stage_ids?: number[];
    value_min?: number;
    value_max?: number;
  };
  webhook?: {
    url?: string;
    isActive?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface BulkRuleManagerProps {
  onRefresh?: () => void;
  onNavigateToRules?: () => void;
}

const BulkRuleManager: React.FC<BulkRuleManagerProps> = ({ onRefresh, onNavigateToRules }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/rules`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Raw API response:', data);
        
        // Transform the API response to match our interface
        const transformedRules = (data.rules || []).map((rule: any) => ({
          id: rule.id.toString(),
          name: rule.name || 'Unnamed Rule',
          message: rule.formatted_message || rule.name || 'No message preview',
          isActive: rule.enabled !== false,
          filters: rule.filters || {},
          webhook: {
            url: rule.webhook_name || null, // Fixed: Use webhook_name from backend
            isActive: rule.target_webhook_id ? true : false // Fixed: Check if webhook is assigned
          },
          createdAt: rule.created_at || rule.createdAt || new Date().toISOString(),
          updatedAt: rule.updated_at || rule.updatedAt || new Date().toISOString()
        }));
        
        console.log('Transformed rules:', transformedRules);
        setRules(transformedRules);
      } else {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error loading rules:', err);
      setError(`Failed to load rules: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && rule.isActive) ||
                         (statusFilter === 'inactive' && !rule.isActive);
    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRules(new Set(filteredRules.map(rule => rule.id)));
    } else {
      setSelectedRules(new Set());
    }
  };

  const handleSelectRule = (ruleId: string, checked: boolean) => {
    const newSelected = new Set(selectedRules);
    if (checked) {
      newSelected.add(ruleId);
    } else {
      newSelected.delete(ruleId);
    }
    setSelectedRules(newSelected);
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedRules.size === 0) return;

    try {
      // In production, this would make API calls
      console.log(`Bulk ${action} for rules:`, Array.from(selectedRules));
      
      if (action === 'delete') {
        setRules(rules.filter(rule => !selectedRules.has(rule.id)));
      } else {
        setRules(rules.map(rule => 
          selectedRules.has(rule.id) 
            ? { ...rule, isActive: action === 'activate' }
            : rule
        ));
      }
      
      setSelectedRules(new Set());
    } catch (err) {
      console.error(`Error performing bulk ${action}:`, err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFiltersDisplay = (filters: Rule['filters']) => {
    const parts = [];
    if (filters.pipeline_ids?.length) parts.push(`Pipeline: ${filters.pipeline_ids.length}`);
    if (filters.stage_ids?.length) parts.push(`Stage: ${filters.stage_ids.length}`);
    if (filters.value_min) parts.push(`Min: $${filters.value_min.toLocaleString()}`);
    if (filters.value_max) parts.push(`Max: $${filters.value_max.toLocaleString()}`);
    return parts.length > 0 ? parts : ['No filters'];
  };

  if (isLoading) {
    return (
      <div className="bulk-rule-manager">
        <div className="bulk-loading">
          <div className="loading-spinner"></div>
          <p>Loading rules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bulk-rule-manager">
        <div className="bulk-error">
          <span className="error-icon">⚠️</span>
          <h3>Error Loading Rules</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={loadRules}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bulk-rule-manager">
      {/* Header */}
      <div className="bulk-header">
        <div className="header-content">
          <h2>📋 Bulk Rule Management</h2>
          <p>Select and manage multiple notification rules at once</p>
        </div>
        <div className="header-actions">
          <button className="export-button" onClick={() => console.log('Export rules')}>
            📥 Export Rules
          </button>
          <button className="import-button" onClick={() => console.log('Import rules')}>
            📤 Import Rules
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search rules by name or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Rules</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <div className="selection-info">
          <span className="selected-count">{selectedRules.size}</span>
          {' '}of{' '}
          <span className="total-count">{filteredRules.length}</span>
          {' '}selected
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRules.size > 0 && (
        <div className="bulk-actions">
          <div className="action-group">
            <h3>Bulk Actions ({selectedRules.size} rules selected)</h3>
            <div className="action-buttons">
              <button
                className="action-button activate"
                onClick={() => handleBulkAction('activate')}
                disabled={selectedRules.size === 0}
              >
                ✅ Activate
              </button>
              <button
                className="action-button deactivate"
                onClick={() => handleBulkAction('deactivate')}
                disabled={selectedRules.size === 0}
              >
                ⏸️ Deactivate
              </button>
              <button
                className="action-button delete"
                onClick={() => handleBulkAction('delete')}
                disabled={selectedRules.size === 0}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
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
                  checked={filteredRules.length > 0 && selectedRules.size === filteredRules.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="rule-name">Rule Name</th>
              <th className="status">Status</th>
              <th className="filters">Filters</th>
              <th className="webhook">Webhook</th>
              <th className="date">Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr 
                key={rule.id}
                className={selectedRules.has(rule.id) ? 'selected' : ''}
              >
                <td className="checkbox-column" data-label="Select">
                  <input
                    type="checkbox"
                    checked={selectedRules.has(rule.id)}
                    onChange={(e) => handleSelectRule(rule.id, e.target.checked)}
                  />
                </td>
                <td className="rule-name" data-label="Rule">
                  <div className="name-cell">
                    <strong>{rule.name}</strong>
                    <div className="message-preview">
                      {rule.message.substring(0, 80)}
                      {rule.message.length > 80 ? '...' : ''}
                    </div>
                  </div>
                </td>
                <td className="status" data-label="Status">
                  <span className={`status ${rule.isActive ? 'active' : 'inactive'}`}>
                    {rule.isActive ? '🟢 Active' : '🔴 Inactive'}
                  </span>
                </td>
                <td className="filters" data-label="Filters">
                  <div className="filters-summary">
                    {getFiltersDisplay(rule.filters).map((filter, index) => (
                      <span key={index} className="filter-tag">{filter}</span>
                    ))}
                  </div>
                </td>
                <td className="webhook" data-label="Webhook">
                  {rule.webhook?.url ? (
                    <span className={`webhook-${rule.webhook.isActive ? 'active' : 'inactive'}`}>
                      {rule.webhook.isActive ? '🔗 Connected' : '⚠️ Inactive'}
                    </span>
                  ) : (
                    <span className="webhook-missing">❌ Not set</span>
                  )}
                </td>
                <td className="date" data-label="Created">
                  {formatDate(rule.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredRules.length === 0 && (
          <div className="no-rules">
            <div className="no-rules-icon">📋</div>
            <h3>No Rules Found</h3>
            <p>
              {searchTerm || statusFilter !== 'all' 
                ? 'No rules match your current filters.'
                : 'No notification rules have been created yet.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkRuleManager;