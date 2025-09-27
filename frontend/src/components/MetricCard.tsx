import React from 'react';
import './MetricCard.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: string;
  gradient?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  gradient,
  isLoading = false,
  onClick
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendClass = () => {
    switch (trend) {
      case 'up':
        return 'trend-up';
      case 'down':
        return 'trend-down';
      case 'stable':
        return 'trend-stable';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="metric-card loading">
        <div className="skeleton-header">
          <div className="skeleton-icon"></div>
          <div className="skeleton-content">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
          </div>
        </div>
        <div className="skeleton-value"></div>
        <div className="skeleton-trend"></div>
      </div>
    );
  }

  return (
    <div 
      className={`metric-card ${onClick ? 'clickable' : ''}`} 
      onClick={onClick}
    >
      <div className="metric-card-header">
        <div className="metric-icon">
          {icon}
        </div>
        <div className="metric-info">
          <h3 className="metric-title">{title}</h3>
          {subtitle && <p className="metric-subtitle">{subtitle}</p>}
        </div>
      </div>
      
      <div className="metric-value-container">
        <span className="metric-value">{value}</span>
        {trend && trendValue && (
          <div className={`metric-trend ${getTrendClass()}`}>
            <span className="trend-icon">{getTrendIcon()}</span>
            <span className="trend-value">{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;