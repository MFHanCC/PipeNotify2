import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { getTenantId, getAuthToken } from '../utils/auth';
import './AnalyticsExport.css';

interface ExportJob {
  export_id: string;
  status: 'pending' | 'completed' | 'failed';
  estimated_completion: string;
  download_url: string;
}

const AnalyticsExport: React.FC = () => {
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [dataRange, setDataRange] = useState('30d');
  const [includeFilters, setIncludeFilters] = useState({
    successful_only: false,
    failed_only: false,
    specific_channels: false,
    high_value_deals: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${API_BASE_URL}/analytics/advanced/export/${tenantId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            format: exportFormat,
            data_range: dataRange,
            filters: includeFilters
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setExportJob(data);
        // Poll for completion
        setTimeout(() => checkExportStatus(data.export_id), 3000);
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const checkExportStatus = async (exportId: string) => {
    try {
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) return;

      const response = await fetch(
        `${API_BASE_URL}/analytics/advanced/export/${tenantId}/${exportId}/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.success && data.download_ready) {
        setExportJob(prev => prev ? { ...prev, status: 'completed' } : null);
      } else if (data.status === 'failed') {
        setExportJob(prev => prev ? { ...prev, status: 'failed' } : null);
        setError('Export processing failed');
      } else {
        // Still processing, check again in 2 seconds
        setTimeout(() => checkExportStatus(exportId), 2000);
      }
    } catch (err) {
      console.error('Export status check failed:', err);
    }
  };

  const downloadExport = async () => {
    if (!exportJob) return;
    
    try {
      const tenantId = getTenantId();
      const token = getAuthToken();
      
      if (!tenantId || !token) return;

      const response = await fetch(exportJob.download_url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
      setError('Download failed');
    }
  };

  const resetExport = () => {
    setExportJob(null);
    setError(null);
  };

  return (
    <div className="analytics-export">
      <div className="export-header">
        <div className="header-content">
          <h3>📄 Data Export</h3>
          <p>Export your analytics data in various formats for external analysis</p>
        </div>
      </div>

      {!exportJob ? (
        <div className="export-configuration">
          {/* Format Selection */}
          <div className="config-section">
            <h4>Export Format</h4>
            <div className="format-options">
              <div 
                className={`format-option ${exportFormat === 'csv' ? 'selected' : ''}`}
                onClick={() => setExportFormat('csv')}
              >
                <div className="format-icon">📊</div>
                <div className="format-details">
                  <h5>CSV</h5>
                  <p>Comma-separated values for spreadsheet analysis</p>
                  <span className="format-features">✓ Excel compatible ✓ Lightweight ✓ Easy to import</span>
                </div>
              </div>
              
              <div 
                className={`format-option ${exportFormat === 'pdf' ? 'selected' : ''}`}
                onClick={() => setExportFormat('pdf')}
              >
                <div className="format-icon">📄</div>
                <div className="format-details">
                  <h5>PDF Report</h5>
                  <p>Professional report with charts and insights</p>
                  <span className="format-features">✓ Presentation ready ✓ Charts included ✓ Shareable</span>
                </div>
              </div>
              
              <div 
                className={`format-option ${exportFormat === 'excel' ? 'selected' : ''}`}
                onClick={() => setExportFormat('excel')}
              >
                <div className="format-icon">📈</div>
                <div className="format-details">
                  <h5>Excel</h5>
                  <p>Full Excel workbook with multiple sheets</p>
                  <span className="format-features">✓ Multiple tabs ✓ Pivot tables ✓ Advanced analysis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="config-section">
            <h4>Date Range</h4>
            <div className="date-range-options">
              <button 
                className={`range-btn ${dataRange === '7d' ? 'active' : ''}`}
                onClick={() => setDataRange('7d')}
              >
                Last 7 Days
              </button>
              <button 
                className={`range-btn ${dataRange === '30d' ? 'active' : ''}`}
                onClick={() => setDataRange('30d')}
              >
                Last 30 Days
              </button>
              <button 
                className={`range-btn ${dataRange === '90d' ? 'active' : ''}`}
                onClick={() => setDataRange('90d')}
              >
                Last 90 Days
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="config-section">
            <h4>Data Filters</h4>
            <div className="filter-options">
              <label className="filter-option">
                <input 
                  type="checkbox"
                  checked={includeFilters.successful_only}
                  onChange={(e) => setIncludeFilters(prev => ({
                    ...prev,
                    successful_only: e.target.checked
                  }))}
                />
                <span>Successful notifications only</span>
              </label>
              
              <label className="filter-option">
                <input 
                  type="checkbox"
                  checked={includeFilters.failed_only}
                  onChange={(e) => setIncludeFilters(prev => ({
                    ...prev,
                    failed_only: e.target.checked
                  }))}
                />
                <span>Failed notifications only</span>
              </label>
              
              <label className="filter-option">
                <input 
                  type="checkbox"
                  checked={includeFilters.specific_channels}
                  onChange={(e) => setIncludeFilters(prev => ({
                    ...prev,
                    specific_channels: e.target.checked
                  }))}
                />
                <span>Include channel-specific data</span>
              </label>
              
              <label className="filter-option">
                <input 
                  type="checkbox"
                  checked={includeFilters.high_value_deals}
                  onChange={(e) => setIncludeFilters(prev => ({
                    ...prev,
                    high_value_deals: e.target.checked
                  }))}
                />
                <span>High-value deals only (&gt;$5,000)</span>
              </label>
            </div>
          </div>

          {/* Export Button */}
          <div className="export-actions">
            <button 
              className="export-btn"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="spinner"></span>
                  Generating Export...
                </>
              ) : (
                <>
                  <span className="export-icon">📤</span>
                  Generate {exportFormat.toUpperCase()} Export
                </>
              )}
            </button>
            
            {error && (
              <div className="export-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="export-status">
          {exportJob.status === 'pending' && (
            <div className="status-pending">
              <div className="status-icon">⏳</div>
              <h4>Export in Progress</h4>
              <p>Your {exportFormat.toUpperCase()} export is being generated...</p>
              <div className="progress-indicator">
                <div className="progress-bar"></div>
              </div>
              <p className="estimated-time">{exportJob.estimated_completion}</p>
            </div>
          )}

          {exportJob.status === 'completed' && (
            <div className="status-completed">
              <div className="status-icon">✅</div>
              <h4>Export Ready!</h4>
              <p>Your {exportFormat.toUpperCase()} export has been generated successfully.</p>
              
              <div className="download-actions">
                <button className="download-btn" onClick={downloadExport}>
                  <span className="download-icon">⬇️</span>
                  Download Export
                </button>
                
                <button className="new-export-btn" onClick={resetExport}>
                  <span className="new-icon">🔄</span>
                  Create New Export
                </button>
              </div>

              <div className="export-details">
                <p><strong>File Info:</strong> 1.2MB, ~1,500 rows</p>
                <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
              </div>
            </div>
          )}

          {exportJob.status === 'failed' && (
            <div className="status-failed">
              <div className="status-icon">❌</div>
              <h4>Export Failed</h4>
              <p>There was an error generating your export. Please try again.</p>
              
              <button className="retry-btn" onClick={resetExport}>
                <span className="retry-icon">🔄</span>
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Export Tips */}
      <div className="export-tips">
        <h4>💡 Export Tips</h4>
        <div className="tips-grid">
          <div className="tip-item">
            <span className="tip-icon">📊</span>
            <span><strong>CSV:</strong> Best for data analysis in Excel or Google Sheets</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📄</span>
            <span><strong>PDF:</strong> Perfect for executive reports and presentations</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📈</span>
            <span><strong>Excel:</strong> Advanced analysis with pivot tables and charts</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔄</span>
            <span><strong>Automation:</strong> Schedule regular exports in Team settings</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsExport;