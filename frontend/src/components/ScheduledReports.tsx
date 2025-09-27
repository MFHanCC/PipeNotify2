import React, { useState } from 'react';
import { 
  useScheduledReports, 
  useCreateScheduledReport, 
  useUpdateScheduledReport, 
  useDeleteScheduledReport 
} from '../hooks/useQueries';
import './ScheduledReports.css';

interface ScheduledReport {
  id: string;
  name: string;
  type: 'executive_summary' | 'technical_deep_dive' | 'performance_analysis' | 'security_assessment' | 'capacity_planning';
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

interface NewReport {
  name: string;
  type: string;
  frequency: string;
  recipients: string[];
  enabled: boolean;
}

const ScheduledReports: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [newReport, setNewReport] = useState<NewReport>({
    name: '',
    type: 'executive_summary',
    frequency: 'weekly',
    recipients: [],
    enabled: true
  });
  const [recipientInput, setRecipientInput] = useState('');

  // React Query hooks
  const { data: reports = [], isLoading, refetch } = useScheduledReports();
  const createReportMutation = useCreateScheduledReport();
  const updateReportMutation = useUpdateScheduledReport();
  const deleteReportMutation = useDeleteScheduledReport();

  const reportTypes = [
    { value: 'executive_summary', label: 'Executive Summary', icon: '📊', description: 'High-level overview for management' },
    { value: 'technical_deep_dive', label: 'Technical Deep Dive', icon: '🔧', description: 'Detailed analysis for engineering teams' },
    { value: 'performance_analysis', label: 'Performance Analysis', icon: '⚡', description: 'System performance metrics and insights' },
    { value: 'security_assessment', label: 'Security Assessment', icon: '🔒', description: 'Security posture and vulnerability analysis' },
    { value: 'capacity_planning', label: 'Capacity Planning', icon: '📈', description: 'Resource usage and scaling recommendations' }
  ];

  const frequencies = [
    { value: 'daily', label: 'Daily', icon: '📅' },
    { value: 'weekly', label: 'Weekly', icon: '📆' },
    { value: 'monthly', label: 'Monthly', icon: '🗓️' }
  ];

  const handleCreateReport = async () => {
    try {
      await createReportMutation.mutateAsync(newReport);
      resetForm();
    } catch (error) {
      console.error('Failed to create scheduled report:', error);
    }
  };

  const handleUpdateReport = async (reportId: string, updates: Partial<ScheduledReport>) => {
    try {
      await updateReportMutation.mutateAsync({ id: reportId, updates });
      setEditingReport(null);
    } catch (error) {
      console.error('Failed to update scheduled report:', error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled report?')) return;

    try {
      await deleteReportMutation.mutateAsync(reportId);
    } catch (error) {
      console.error('Failed to delete scheduled report:', error);
    }
  };

  const handleToggleReport = async (report: ScheduledReport) => {
    await handleUpdateReport(report.id, { enabled: !report.enabled });
  };

  const addRecipient = () => {
    if (recipientInput.trim() && !newReport.recipients.includes(recipientInput.trim())) {
      setNewReport(prev => ({
        ...prev,
        recipients: [...prev.recipients, recipientInput.trim()]
      }));
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setNewReport(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  const resetForm = () => {
    setNewReport({
      name: '',
      type: 'executive_summary',
      frequency: 'weekly',
      recipients: [],
      enabled: true
    });
    setRecipientInput('');
    setShowCreateForm(false);
  };

  const getReportTypeInfo = (type: string) => {
    return reportTypes.find(rt => rt.value === type) || reportTypes[0];
  };

  const getFrequencyInfo = (frequency: string) => {
    return frequencies.find(f => f.value === frequency) || frequencies[1];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="scheduled-reports">
        <div className="loading-container">
          <div className="loading-spinner">🔄</div>
          <p>Loading scheduled reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduled-reports">
      <div className="reports-header">
        <div className="header-content">
          <h2>📊 Scheduled Reports</h2>
          <p>Automate report generation and delivery to keep your team informed</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="create-report-btn"
        >
          ➕ Schedule New Report
        </button>
      </div>

      {/* Reports List */}
      <div className="reports-list">
        {reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Scheduled Reports</h3>
            <p>Create your first scheduled report to automate regular insights delivery</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="create-first-btn"
            >
              Schedule Your First Report
            </button>
          </div>
        ) : (
          reports.map((report: ScheduledReport) => {
            const typeInfo = getReportTypeInfo(report.type);
            const frequencyInfo = getFrequencyInfo(report.frequency);
            
            return (
              <div key={report.id} className={`report-card ${!report.enabled ? 'disabled' : ''}`}>
                <div className="report-header">
                  <div className="report-info">
                    <div className="report-title">
                      <span className="report-icon">{typeInfo.icon}</span>
                      <h3>{report.name}</h3>
                      <span className={`status-badge ${report.enabled ? 'active' : 'inactive'}`}>
                        {report.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="report-description">{typeInfo.description}</p>
                  </div>
                  <div className="report-actions">
                    <button
                      onClick={() => handleToggleReport(report)}
                      className={`toggle-btn ${report.enabled ? 'active' : 'inactive'}`}
                      title={report.enabled ? 'Disable report' : 'Enable report'}
                    >
                      {report.enabled ? '⏸️' : '▶️'}
                    </button>
                    <button
                      onClick={() => setEditingReport(report)}
                      className="edit-btn"
                      title="Edit report"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="delete-btn"
                      title="Delete report"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="report-details">
                  <div className="detail-item">
                    <span className="detail-label">Frequency:</span>
                    <span className="detail-value">
                      {frequencyInfo.icon} {frequencyInfo.label}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Recipients:</span>
                    <span className="detail-value">{report.recipients.length} recipients</span>
                  </div>
                  {report.lastRun && (
                    <div className="detail-item">
                      <span className="detail-label">Last Run:</span>
                      <span className="detail-value">{formatDate(report.lastRun)}</span>
                    </div>
                  )}
                  {report.nextRun && (
                    <div className="detail-item">
                      <span className="detail-label">Next Run:</span>
                      <span className="detail-value">{formatDate(report.nextRun)}</span>
                    </div>
                  )}
                </div>

                <div className="recipients-list">
                  {report.recipients.map((email: string) => (
                    <span key={email} className="recipient-tag">{email}</span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Report Modal */}
      {(showCreateForm || editingReport) && (
        <div className="modal-overlay" onClick={() => { resetForm(); setEditingReport(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingReport ? '✏️ Edit Report' : '➕ Schedule New Report'}
              </h3>
              <button
                onClick={() => { resetForm(); setEditingReport(null); }}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Report Name</label>
                <input
                  type="text"
                  value={editingReport ? editingReport.name : newReport.name}
                  onChange={e => {
                    if (editingReport) {
                      setEditingReport({ ...editingReport, name: e.target.value });
                    } else {
                      setNewReport({ ...newReport, name: e.target.value });
                    }
                  }}
                  placeholder="Enter report name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Report Type</label>
                <div className="report-types-grid">
                  {reportTypes.map(type => (
                    <div
                      key={type.value}
                      onClick={() => {
                        if (editingReport) {
                          setEditingReport({ ...editingReport, type: type.value as any });
                        } else {
                          setNewReport({ ...newReport, type: type.value });
                        }
                      }}
                      className={`report-type-card ${
                        (editingReport ? editingReport.type : newReport.type) === type.value ? 'selected' : ''
                      }`}
                    >
                      <div className="type-icon">{type.icon}</div>
                      <div className="type-info">
                        <h4>{type.label}</h4>
                        <p>{type.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Frequency</label>
                <div className="frequency-options">
                  {frequencies.map(freq => (
                    <button
                      key={freq.value}
                      onClick={() => {
                        if (editingReport) {
                          setEditingReport({ ...editingReport, frequency: freq.value as any });
                        } else {
                          setNewReport({ ...newReport, frequency: freq.value });
                        }
                      }}
                      className={`frequency-btn ${
                        (editingReport ? editingReport.frequency : newReport.frequency) === freq.value ? 'selected' : ''
                      }`}
                    >
                      {freq.icon} {freq.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Recipients</label>
                <div className="recipients-input">
                  <input
                    type="email"
                    value={recipientInput}
                    onChange={e => setRecipientInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                    placeholder="Enter email address"
                    className="form-input"
                  />
                  <button onClick={addRecipient} className="add-recipient-btn">
                    Add
                  </button>
                </div>
                <div className="recipients-tags">
                  {(editingReport ? editingReport.recipients : newReport.recipients).map(email => (
                    <span key={email} className="recipient-tag">
                      {email}
                      <button
                        onClick={() => {
                          if (editingReport) {
                            setEditingReport({
                              ...editingReport,
                              recipients: editingReport.recipients.filter(r => r !== email)
                            });
                          } else {
                            removeRecipient(email);
                          }
                        }}
                        className="remove-recipient"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => { resetForm(); setEditingReport(null); }}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingReport) {
                    handleUpdateReport(editingReport.id, editingReport);
                  } else {
                    handleCreateReport();
                  }
                }}
                className="save-btn"
                disabled={
                  !(editingReport ? editingReport.name : newReport.name) ||
                  (editingReport ? editingReport.recipients : newReport.recipients).length === 0
                }
              >
                {editingReport ? 'Update Report' : 'Schedule Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;