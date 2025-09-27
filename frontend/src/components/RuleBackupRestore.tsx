import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import './RuleBackupRestore.css';

interface BackupData {
  id: string;
  name: string;
  description?: string;
  ruleCount: number;
  createdAt: string;
  size: string;
  type: 'manual' | 'automatic';
}

interface NotificationRule {
  id: string;
  rule_name: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const RuleBackupRestore: React.FC = () => {
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(null);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [restoreOptions, setRestoreOptions] = useState({
    overwriteExisting: false,
    preserveIds: false,
    activateRules: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const [backupsResponse, rulesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/rules/backups`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/api/v1/rules`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (backupsResponse.ok) {
        const backupsData = await backupsResponse.json();
        setBackups(backupsData.backups || []);
      } else {
        // Fallback to mock data for demo
        setBackups([
          {
            id: '1',
            name: 'Production Rules Backup',
            description: 'Complete backup before system update',
            ruleCount: 15,
            createdAt: '2024-12-15T10:30:00Z',
            size: '2.3 KB',
            type: 'manual'
          },
          {
            id: '2',
            name: 'Daily Auto Backup',
            description: 'Automated daily backup',
            ruleCount: 15,
            createdAt: '2024-12-15T02:00:00Z',
            size: '2.3 KB',
            type: 'automatic'
          }
        ]);
      }

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData.rules || []);
      }
    } catch (error) {
      console.error('Failed to load backup data:', error);
      setBackups([]);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: backupName,
          description: backupDescription,
          type: 'manual'
        })
      });

      if (response.ok) {
        await loadData();
        resetCreateForm();
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(restoreOptions)
      });

      if (response.ok) {
        await loadData();
        setShowRestoreModal(false);
        setSelectedBackup(null);
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('Are you sure you want to delete this backup? This action cannot be undone.')) return;

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const handleDownloadBackup = async (backup: BackupData) => {
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups/${backup.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backup.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_backup.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download backup:', error);
    }
  };

  const resetCreateForm = () => {
    setBackupName('');
    setBackupDescription('');
    setShowCreateBackup(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getBackupTypeIcon = (type: string) => {
    return type === 'automatic' ? '🤖' : '👤';
  };

  if (isLoading) {
    return (
      <div className="rule-backup-restore">
        <div className="loading-container">
          <div className="loading-spinner">🔄</div>
          <p>Loading backup data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-backup-restore">
      <div className="backup-header">
        <div className="header-content">
          <h2>💾 Rule Backup & Restore</h2>
          <p>Safely backup and restore your notification rules configuration</p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowCreateBackup(true)}
            className="create-backup-btn"
          >
            ➕ Create Backup
          </button>
        </div>
      </div>

      {/* Current Rules Summary */}
      <div className="current-rules-summary">
        <div className="summary-card">
          <div className="summary-icon">📋</div>
          <div className="summary-content">
            <h3>Current Rules</h3>
            <p className="rule-count">{rules.length} notification rules</p>
            <p className="rule-details">
              {rules.filter(r => r.is_active).length} active • {rules.filter(r => !r.is_active).length} inactive
            </p>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="backups-section">
        <h3>Available Backups</h3>
        {backups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h4>No Backups Found</h4>
            <p>Create your first backup to safeguard your notification rules</p>
            <button
              onClick={() => setShowCreateBackup(true)}
              className="create-first-btn"
            >
              Create First Backup
            </button>
          </div>
        ) : (
          <div className="backups-grid">
            {backups.map(backup => (
              <div key={backup.id} className="backup-card">
                <div className="backup-header">
                  <div className="backup-info">
                    <div className="backup-title">
                      <span className="backup-type-icon">{getBackupTypeIcon(backup.type)}</span>
                      <h4>{backup.name}</h4>
                      <span className={`type-badge ${backup.type}`}>
                        {backup.type}
                      </span>
                    </div>
                    {backup.description && (
                      <p className="backup-description">{backup.description}</p>
                    )}
                  </div>
                </div>

                <div className="backup-details">
                  <div className="detail-item">
                    <span className="detail-label">Rules:</span>
                    <span className="detail-value">{backup.ruleCount} rules</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Size:</span>
                    <span className="detail-value">{backup.size}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">{formatDate(backup.createdAt)}</span>
                  </div>
                </div>

                <div className="backup-actions">
                  <button
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowRestoreModal(true);
                    }}
                    className="restore-btn"
                    title="Restore backup"
                  >
                    🔄 Restore
                  </button>
                  <button
                    onClick={() => handleDownloadBackup(backup)}
                    className="download-btn"
                    title="Download backup"
                  >
                    ⬇️ Download
                  </button>
                  {backup.type === 'manual' && (
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="delete-btn"
                      title="Delete backup"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateBackup && (
        <div className="modal-overlay" onClick={resetCreateForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💾 Create New Backup</h3>
              <button
                onClick={resetCreateForm}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Backup Name</label>
                <input
                  type="text"
                  value={backupName}
                  onChange={e => setBackupName(e.target.value)}
                  placeholder="Enter backup name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={backupDescription}
                  onChange={e => setBackupDescription(e.target.value)}
                  placeholder="Describe this backup (optional)"
                  className="form-textarea"
                  rows={3}
                />
              </div>

              <div className="backup-preview">
                <h4>Backup Contents Preview</h4>
                <div className="preview-stats">
                  <div className="stat-item">
                    <span className="stat-icon">📋</span>
                    <span className="stat-label">Total Rules:</span>
                    <span className="stat-value">{rules.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">✅</span>
                    <span className="stat-label">Active Rules:</span>
                    <span className="stat-value">{rules.filter(r => r.is_active).length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">⏸️</span>
                    <span className="stat-label">Inactive Rules:</span>
                    <span className="stat-value">{rules.filter(r => !r.is_active).length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={resetCreateForm}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                className="save-btn"
                disabled={!backupName.trim()}
              >
                Create Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔄 Restore Backup</h3>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="restore-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h4>Important: Backup Restoration</h4>
                  <p>Restoring this backup will modify your current notification rules. Please review the options below carefully.</p>
                </div>
              </div>

              <div className="backup-info">
                <h4>Backup Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Name:</span>
                    <span className="info-value">{selectedBackup.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Rules:</span>
                    <span className="info-value">{selectedBackup.ruleCount} rules</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Created:</span>
                    <span className="info-value">{formatDate(selectedBackup.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="restore-options">
                <h4>Restore Options</h4>
                <div className="option-group">
                  <label className="option-item">
                    <input
                      type="checkbox"
                      checked={restoreOptions.overwriteExisting}
                      onChange={e => setRestoreOptions({
                        ...restoreOptions,
                        overwriteExisting: e.target.checked
                      })}
                    />
                    <span className="option-label">Overwrite existing rules</span>
                    <span className="option-description">Replace current rules with backup versions</span>
                  </label>

                  <label className="option-item">
                    <input
                      type="checkbox"
                      checked={restoreOptions.preserveIds}
                      onChange={e => setRestoreOptions({
                        ...restoreOptions,
                        preserveIds: e.target.checked
                      })}
                    />
                    <span className="option-label">Preserve rule IDs</span>
                    <span className="option-description">Keep original rule identifiers</span>
                  </label>

                  <label className="option-item">
                    <input
                      type="checkbox"
                      checked={restoreOptions.activateRules}
                      onChange={e => setRestoreOptions({
                        ...restoreOptions,
                        activateRules: e.target.checked
                      })}
                    />
                    <span className="option-label">Activate restored rules</span>
                    <span className="option-description">Enable rules immediately after restoration</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                className="restore-confirm-btn"
              >
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Information */}
      <div className="backup-info-section">
        <h4>Backup Information</h4>
        <ul>
          <li><strong>Automatic Backups:</strong> Created daily at 2:00 AM to preserve your rule configuration</li>
          <li><strong>Manual Backups:</strong> Create on-demand backups before making significant changes</li>
          <li><strong>Backup Contents:</strong> All notification rules, conditions, actions, and settings</li>
          <li><strong>Restore Options:</strong> Flexible restoration with overwrite and activation controls</li>
        </ul>
      </div>
    </div>
  );
};

export default RuleBackupRestore;