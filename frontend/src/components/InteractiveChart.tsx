import React, { useState, useMemo } from 'react';
import './InteractiveChart.css';

interface ChartDataPoint {
  timestamp: string;
  success: number;
  failure: number;
  responseTime: number;
}

interface InteractiveChartProps {
  data: ChartDataPoint[];
  title: string;
  type: 'line' | 'bar' | 'area';
  height?: number;
  isLoading?: boolean;
  showTooltip?: boolean;
  allowZoom?: boolean;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  title,
  type = 'line',
  height = 300,
  isLoading = false,
  showTooltip = true,
  allowZoom = true
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: ChartDataPoint & { x: number; y: number } } | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'success' | 'failure' | 'responseTime'>('success');

  const chartDimensions = {
    width: 100, // percentage
    height: height,
    padding: { top: 20, right: 30, bottom: 40, left: 50 }
  };

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const maxSuccess = Math.max(...data.map(d => d.success));
    const maxFailure = Math.max(...data.map(d => d.failure));
    const maxResponseTime = Math.max(...data.map(d => d.responseTime));
    
    const getMaxForMetric = (metric: string) => {
      switch (metric) {
        case 'success': return maxSuccess;
        case 'failure': return maxFailure;
        case 'responseTime': return maxResponseTime;
        default: return 100;
      }
    };

    return data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const maxValue = getMaxForMetric(selectedMetric);
      const value = point[selectedMetric as keyof ChartDataPoint] as number;
      const y = 100 - ((value / (maxValue || 1)) * 80); // 80% of chart height
      
      return {
        ...point,
        x,
        y,
        index
      };
    });
  }, [data, selectedMetric]);

  const createPath = () => {
    if (processedData.length === 0) return '';
    
    const points = processedData.map(d => `${d.x},${d.y}`).join(' L ');
    return `M ${points}`;
  };

  const createAreaPath = () => {
    if (processedData.length === 0) return '';
    
    const points = processedData.map(d => `${d.x},${d.y}`).join(' L ');
    const firstPoint = processedData[0];
    const lastPoint = processedData[processedData.length - 1];
    
    return `M ${firstPoint.x},100 L ${points} L ${lastPoint.x},100 Z`;
  };

  const handleMouseMove = (event: React.MouseEvent<SVGElement>) => {
    if (!showTooltip || processedData.length === 0) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    
    // Find closest data point
    const closest = processedData.reduce((prev, curr) => 
      Math.abs(curr.x - x) < Math.abs(prev.x - x) ? curr : prev
    );
    
    setHoveredPoint({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      data: closest
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'responseTime':
        return `${value}ms`;
      case 'success':
      case 'failure':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'success':
        return '#10b981';
      case 'failure':
        return '#ef4444';
      case 'responseTime':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  if (isLoading) {
    return (
      <div className="interactive-chart loading" style={{ height }}>
        <div className="chart-header">
          <div className="skeleton-title"></div>
          <div className="skeleton-controls"></div>
        </div>
        <div className="chart-skeleton">
          <div className="skeleton-bars">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="skeleton-bar" 
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="interactive-chart" style={{ height }}>
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-controls">
          <div className="metric-selector">
            {['success', 'failure', 'responseTime'].map((metric) => (
              <button
                key={metric}
                className={`metric-btn ${selectedMetric === metric ? 'active' : ''}`}
                onClick={() => setSelectedMetric(metric as any)}
                style={{ 
                  '--metric-color': getMetricColor(metric),
                  backgroundColor: selectedMetric === metric ? getMetricColor(metric) : 'transparent'
                } as React.CSSProperties}
              >
                {metric === 'responseTime' ? 'Response Time' : metric.charAt(0).toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <svg 
          width="100%" 
          height={height - 60}
          viewBox={`0 0 100 100`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="chart-svg"
        >
          {/* Grid Lines */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
            </pattern>
            <linearGradient id={`gradient-${selectedMetric}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={getMetricColor(selectedMetric)} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={getMetricColor(selectedMetric)} stopOpacity="0.05"/>
            </linearGradient>
          </defs>
          
          <rect width="100" height="100" fill="url(#grid)" opacity="0.3"/>

          {/* Chart Content */}
          {type === 'area' && (
            <path
              d={createAreaPath()}
              fill={`url(#gradient-${selectedMetric})`}
              className="chart-area"
            />
          )}
          
          {type === 'line' && (
            <path
              d={createPath()}
              fill="none"
              stroke={getMetricColor(selectedMetric)}
              strokeWidth="2"
              className="chart-line"
            />
          )}

          {type === 'bar' && processedData.map((point, index) => (
            <rect
              key={index}
              x={point.x - 1}
              y={point.y}
              width="2"
              height={100 - point.y}
              fill={getMetricColor(selectedMetric)}
              className="chart-bar"
              opacity="0.8"
            />
          ))}

          {/* Data Points */}
          {(type === 'line' || type === 'area') && processedData.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="2"
              fill={getMetricColor(selectedMetric)}
              className="chart-point"
            />
          ))}

          {/* Hover Line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.data.x}
              y1="0"
              x2={hoveredPoint.data.x}
              y2="100"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          )}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && showTooltip && (
          <div 
            className="chart-tooltip"
            style={{
              left: hoveredPoint.x,
              top: hoveredPoint.y - 10,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="tooltip-date">
              {new Date(hoveredPoint.data.timestamp).toLocaleDateString()}
            </div>
            <div className="tooltip-value" style={{ color: getMetricColor(selectedMetric) }}>
              {formatValue(hoveredPoint.data[selectedMetric], selectedMetric)}
            </div>
            <div className="tooltip-extra">
              Success: {hoveredPoint.data.success} | 
              Failures: {hoveredPoint.data.failure}
            </div>
          </div>
        )}
      </div>

      {processedData.length === 0 && (
        <div className="chart-empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No Data Available</div>
          <div className="empty-subtitle">Data will appear here once notifications are sent</div>
        </div>
      )}
    </div>
  );
};

export default InteractiveChart;