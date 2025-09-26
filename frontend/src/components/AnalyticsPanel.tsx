import { API_BASE_URL } from '../config/api';
import React, { useState, useEffect, useMemo } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import BasicAnalyticsDashboard from './BasicAnalyticsDashboard';
import AdvancedAnalyticsDashboard from './AdvancedAnalyticsDashboard';
import './AnalyticsPanel.css';

interface AnalyticsPanelProps {
  tenantId: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ 
  tenantId, 
  dateRange, 
  onDateRangeChange 
}) => {
  const { hasFeature, loading } = usePlanFeatures();

  const handleRefresh = () => {
    // Refresh logic can be passed to child components
    console.log('Analytics refresh requested');
  };

  // Wait for features to load to prevent UI flicker
  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  // Team Plan users get Advanced Analytics
  if (hasFeature('advanced_analytics')) {
    return <AdvancedAnalyticsDashboard onRefresh={handleRefresh} />;
  }
  
  // Pro and Starter users get Basic Analytics  
  return <BasicAnalyticsDashboard onRefresh={handleRefresh} />;
};

export default AnalyticsPanel;