import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DateRangePicker.css';

interface DateRangePickerProps {
  onDateRangeChange: (startDate: Date | null, endDate: Date | null, preset?: string) => void;
  selectedPreset?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ 
  onDateRangeChange, 
  selectedPreset = '7d' 
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [currentPreset, setCurrentPreset] = useState(selectedPreset);

  const presetRanges = [
    { value: '1d', label: 'Last 24 Hours', icon: '📅' },
    { value: '7d', label: 'Last 7 Days', icon: '📆' },
    { value: '30d', label: 'Last 30 Days', icon: '🗓️' },
    { value: '90d', label: 'Last 90 Days', icon: '📊' },
    { value: 'custom', label: 'Custom Range', icon: '🎯' }
  ];

  const handlePresetChange = (preset: string) => {
    setCurrentPreset(preset);
    
    if (preset === 'custom') {
      setShowCustomPicker(true);
      return;
    }

    setShowCustomPicker(false);
    const now = new Date();
    let startDate: Date;

    switch (preset) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    onDateRangeChange(startDate, now, preset);
  };

  const handleCustomDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    
    if (start && end) {
      onDateRangeChange(start, end, 'custom');
    }
  };

  const formatCustomRange = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }
    return 'Select date range';
  };

  return (
    <div className="date-range-picker">
      <div className="preset-buttons">
        {presetRanges.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value)}
            className={`preset-btn ${currentPreset === preset.value ? 'active' : ''}`}
            title={preset.label}
          >
            <span className="preset-icon">{preset.icon}</span>
            <span className="preset-label">{preset.label}</span>
          </button>
        ))}
      </div>

      {showCustomPicker && (
        <div className="custom-picker-container">
          <div className="custom-picker-header">
            <h4>📅 Select Custom Date Range</h4>
            <button 
              onClick={() => setShowCustomPicker(false)}
              className="close-picker-btn"
              title="Close date picker"
            >
              ✕
            </button>
          </div>
          <div className="date-picker-wrapper">
            <DatePicker
              selected={startDate}
              onChange={handleCustomDateChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              inline
              maxDate={new Date()}
              showDisabledMonthNavigation
              calendarClassName="custom-calendar"
            />
          </div>
          {startDate && endDate && (
            <div className="selected-range-display">
              <span className="range-icon">📅</span>
              <span className="range-text">{formatCustomRange()}</span>
              <span className="range-days">
                ({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;