import React, { useState, useEffect } from 'react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import './RuleFilters.css';

interface FilterData {
  // Value filters
  value_min?: number;
  value_max?: number;
  
  // Probability filters  
  probability_min?: number;
  probability_max?: number;
  
  // Pipeline/Stage filters
  pipeline_ids?: number[];
  stage_ids?: number[];
  
  // Owner filters
  owner_ids?: number[];
  
  // Time restrictions
  time_restrictions?: {
    business_hours_only?: boolean;
    start_hour?: number;
    end_hour?: number;
    weekdays_only?: boolean;
  };
  
  // Label filters
  labels?: string[];
  label_match_type?: 'any' | 'all';
  
  // Currency filters
  currencies?: string[];
}

interface RuleFiltersProps {
  filters: FilterData;
  onChange: (filters: FilterData) => void;
}

interface PipelineData {
  id: number;
  name: string;
  stages: StageData[];
}

interface StageData {
  id: number;
  name: string;
  order_nr: number;
}

interface UserData {
  id: number;
  name: string;
  email: string;
}

const RuleFilters: React.FC<RuleFiltersProps> = ({ filters, onChange }) => {
  const { hasFeature, getFeatureRequiredPlan, planTier } = usePlanFeatures();
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>('value');
  
  // Feature availability checks
  const canUseValueFiltering = hasFeature('value_filtering');
  const canUseStageFiltering = hasFeature('stage_filtering');
  const canUseProbabilityFiltering = hasFeature('probability_filtering');
  const canUseOwnerFiltering = hasFeature('owner_filtering');
  const canUseTimeFiltering = hasFeature('time_filtering');

  useEffect(() => {
    loadPipelineData();
    loadUserData();
  }, []);

  const loadPipelineData = async () => {
    try {
      // Mock data for now - in production, this would fetch from Pipedrive API
      const mockPipelines: PipelineData[] = [
        {
          id: 1,
          name: 'Sales Pipeline',
          stages: [
            { id: 1, name: 'Qualified', order_nr: 1 },
            { id: 2, name: 'Contact Made', order_nr: 2 },
            { id: 3, name: 'Proposal Made', order_nr: 3 },
            { id: 4, name: 'Negotiations', order_nr: 4 },
            { id: 5, name: 'Won', order_nr: 5 },
            { id: 6, name: 'Lost', order_nr: 6 },
          ]
        },
        {
          id: 2,
          name: 'Partnership Pipeline',
          stages: [
            { id: 7, name: 'Initial Contact', order_nr: 1 },
            { id: 8, name: 'Discussion', order_nr: 2 },
            { id: 9, name: 'Agreement', order_nr: 3 },
            { id: 10, name: 'Signed', order_nr: 4 },
          ]
        }
      ];
      setPipelines(mockPipelines);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
    }
  };

  const loadUserData = async () => {
    try {
      // Mock data for now - in production, this would fetch from Pipedrive API
      const mockUsers: UserData[] = [
        { id: 1, name: 'John Doe', email: 'john@company.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@company.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@company.com' },
      ];
      setUsers(mockUsers);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsLoading(false);
    }
  };

  const updateFilters = (newFilters: Partial<FilterData>) => {
    onChange({ ...filters, ...newFilters });
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const getSelectedStages = () => {
    const selectedPipeline = pipelines.find(p => 
      filters.pipeline_ids?.includes(p.id)
    );
    return selectedPipeline?.stages || [];
  };

  const renderValueFilters = () => (
    <div className={`filter-section ${!canUseValueFiltering ? 'disabled' : ''}`}>
      <div 
        className={`filter-header ${activeSection === 'value' ? 'active' : ''}`}
        onClick={() => canUseValueFiltering && toggleSection('value')}
      >
        <span>💰 Deal Value Filters</span>
        {!canUseValueFiltering && (
          <span 
            className="feature-lock" 
            title={`Value filtering is available in ${getFeatureRequiredPlan('value_filtering')} plan and above`}
          >
            🔒
          </span>
        )}
        <span className="toggle-icon">{activeSection === 'value' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'value' && (
        <div className="filter-content">
          <div className="filter-row">
            <div className="filter-group">
              <label>Minimum Value ($)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={filters.value_min || ''}
                onChange={(e) => updateFilters({
                  value_min: e.target.value ? parseInt(e.target.value) : undefined
                })}
                placeholder="e.g., 1000"
                disabled={!canUseValueFiltering}
              />
            </div>
            
            <div className="filter-group">
              <label>Maximum Value ($)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={filters.value_max || ''}
                onChange={(e) => updateFilters({
                  value_max: e.target.value ? parseInt(e.target.value) : undefined
                })}
                placeholder="e.g., 50000"
                disabled={!canUseValueFiltering}
              />
            </div>
          </div>
          
          <div className="preset-buttons">
            <button 
              type="button"
              className="preset-button"
              onClick={() => updateFilters({ value_min: 1000, value_max: undefined })}
            >
              $1K+ Deals
            </button>
            <button 
              type="button"
              className="preset-button"
              onClick={() => updateFilters({ value_min: 10000, value_max: undefined })}
            >
              $10K+ Deals
            </button>
            <button 
              type="button"
              className="preset-button"
              onClick={() => updateFilters({ value_min: 50000, value_max: undefined })}
            >
              $50K+ Deals
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderProbabilityFilters = () => (
    <div className="filter-section">
      <div 
        className={`filter-header ${activeSection === 'probability' ? 'active' : ''}`}
        onClick={() => toggleSection('probability')}
      >
        <span>📈 Probability Filters</span>
        <span className="toggle-icon">{activeSection === 'probability' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'probability' && (
        <div className="filter-content">
          <div className="filter-row">
            <div className="filter-group">
              <label>Minimum Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={filters.probability_min || ''}
                onChange={(e) => updateFilters({
                  probability_min: e.target.value ? parseInt(e.target.value) : undefined
                })}
                placeholder="e.g., 70"
              />
            </div>
            
            <div className="filter-group">
              <label>Maximum Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={filters.probability_max || ''}
                onChange={(e) => updateFilters({
                  probability_max: e.target.value ? parseInt(e.target.value) : undefined
                })}
                placeholder="e.g., 90"
              />
            </div>
          </div>
          
          <div className="preset-buttons">
            <button 
              type="button"
              className="preset-button"
              onClick={() => updateFilters({ probability_min: 80, probability_max: undefined })}
            >
              Hot Prospects (80%+)
            </button>
            <button 
              type="button"
              className="preset-button"
              onClick={() => updateFilters({ probability_min: 90, probability_max: undefined })}
            >
              Almost Closed (90%+)
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderPipelineStageFilters = () => (
    <div className="filter-section">
      <div 
        className={`filter-header ${activeSection === 'pipeline' ? 'active' : ''}`}
        onClick={() => toggleSection('pipeline')}
      >
        <span>🏗️ Pipeline & Stage Filters</span>
        <span className="toggle-icon">{activeSection === 'pipeline' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'pipeline' && (
        <div className="filter-content">
          <div className="filter-group">
            <label>Pipelines</label>
            <div className="checkbox-list">
              {pipelines.map(pipeline => (
                <label key={pipeline.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.pipeline_ids?.includes(pipeline.id) || false}
                    onChange={(e) => {
                      const currentPipelines = filters.pipeline_ids || [];
                      const newPipelines = e.target.checked
                        ? [...currentPipelines, pipeline.id]
                        : currentPipelines.filter(id => id !== pipeline.id);
                      updateFilters({ 
                        pipeline_ids: newPipelines.length > 0 ? newPipelines : undefined,
                        // Clear stage selection if pipeline is deselected
                        stage_ids: e.target.checked ? filters.stage_ids : undefined
                      });
                    }}
                  />
                  <span>{pipeline.name}</span>
                </label>
              ))}
            </div>
          </div>
          
          {filters.pipeline_ids && filters.pipeline_ids.length > 0 && (
            <div className="filter-group">
              <label>Stages</label>
              <div className="checkbox-list">
                {getSelectedStages().map(stage => (
                  <label key={stage.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={filters.stage_ids?.includes(stage.id) || false}
                      onChange={(e) => {
                        const currentStages = filters.stage_ids || [];
                        const newStages = e.target.checked
                          ? [...currentStages, stage.id]
                          : currentStages.filter(id => id !== stage.id);
                        updateFilters({ 
                          stage_ids: newStages.length > 0 ? newStages : undefined
                        });
                      }}
                    />
                    <span>{stage.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderOwnerFilters = () => (
    <div className="filter-section">
      <div 
        className={`filter-header ${activeSection === 'owner' ? 'active' : ''}`}
        onClick={() => toggleSection('owner')}
      >
        <span>👤 Deal Owner Filters</span>
        <span className="toggle-icon">{activeSection === 'owner' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'owner' && (
        <div className="filter-content">
          <div className="filter-group">
            <label>Deal Owners</label>
            <div className="checkbox-list">
              {users.map(user => (
                <label key={user.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.owner_ids?.includes(user.id) || false}
                    onChange={(e) => {
                      const currentOwners = filters.owner_ids || [];
                      const newOwners = e.target.checked
                        ? [...currentOwners, user.id]
                        : currentOwners.filter(id => id !== user.id);
                      updateFilters({ 
                        owner_ids: newOwners.length > 0 ? newOwners : undefined
                      });
                    }}
                  />
                  <span>{user.name} ({user.email})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTimeFilters = () => (
    <div className="filter-section">
      <div 
        className={`filter-header ${activeSection === 'time' ? 'active' : ''}`}
        onClick={() => toggleSection('time')}
      >
        <span>⏰ Time-based Filters</span>
        <span className="toggle-icon">{activeSection === 'time' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'time' && (
        <div className="filter-content">
          <div className="filter-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.time_restrictions?.business_hours_only || false}
                onChange={(e) => updateFilters({
                  time_restrictions: {
                    ...filters.time_restrictions,
                    business_hours_only: e.target.checked
                  }
                })}
              />
              <span>Only notify during business hours</span>
            </label>
          </div>
          
          {filters.time_restrictions?.business_hours_only && (
            <>
              <div className="filter-row">
                <div className="filter-group">
                  <label>Start Hour (24h format)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={filters.time_restrictions?.start_hour || 9}
                    onChange={(e) => updateFilters({
                      time_restrictions: {
                        ...filters.time_restrictions,
                        start_hour: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>
                
                <div className="filter-group">
                  <label>End Hour (24h format)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={filters.time_restrictions?.end_hour || 17}
                    onChange={(e) => updateFilters({
                      time_restrictions: {
                        ...filters.time_restrictions,
                        end_hour: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>
              </div>
              
              <div className="filter-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.time_restrictions?.weekdays_only || false}
                    onChange={(e) => updateFilters({
                      time_restrictions: {
                        ...filters.time_restrictions,
                        weekdays_only: e.target.checked
                      }
                    })}
                  />
                  <span>Weekdays only (Mon-Fri)</span>
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderCurrencyFilters = () => (
    <div className="filter-section">
      <div 
        className={`filter-header ${activeSection === 'currency' ? 'active' : ''}`}
        onClick={() => toggleSection('currency')}
      >
        <span>💱 Currency Filters</span>
        <span className="toggle-icon">{activeSection === 'currency' ? '−' : '+'}</span>
      </div>
      
      {activeSection === 'currency' && (
        <div className="filter-content">
          <div className="filter-group">
            <label>Allowed Currencies</label>
            <div className="checkbox-list">
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(currency => (
                <label key={currency} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.currencies?.includes(currency) || false}
                    onChange={(e) => {
                      const currentCurrencies = filters.currencies || [];
                      const newCurrencies = e.target.checked
                        ? [...currentCurrencies, currency]
                        : currentCurrencies.filter(c => c !== currency);
                      updateFilters({ 
                        currencies: newCurrencies.length > 0 ? newCurrencies : undefined
                      });
                    }}
                  />
                  <span>{currency}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const hasActiveFilters = () => {
    return Object.keys(filters).some(key => {
      const value = filters[key as keyof FilterData];
      return value !== undefined && value !== null && 
             (Array.isArray(value) ? value.length > 0 : true);
    });
  };

  const clearAllFilters = () => {
    onChange({});
    setActiveSection('value');
  };

  if (isLoading) {
    return <div className="rule-filters-loading">Loading filter options...</div>;
  }

  return (
    <div className="rule-filters">
      <div className="filters-header">
        <h4>Advanced Filters</h4>
        <div className="filter-actions">
          {hasActiveFilters() && (
            <button 
              type="button"
              className="clear-filters-button"
              onClick={clearAllFilters}
            >
              Clear All
            </button>
          )}
          <span className="filter-count">
            {hasActiveFilters() ? 'Filters active' : 'No filters set'}
          </span>
        </div>
      </div>
      
      <div className="filters-content">
        {renderValueFilters()}
        {renderProbabilityFilters()}
        {renderPipelineStageFilters()}
        {renderOwnerFilters()}
        {renderTimeFilters()}
        {renderCurrencyFilters()}
      </div>
      
      {hasActiveFilters() && (
        <div className="filter-summary">
          <h5>Active Filters Summary:</h5>
          <ul>
            {filters.value_min && <li>Min Value: ${filters.value_min.toLocaleString()}</li>}
            {filters.value_max && <li>Max Value: ${filters.value_max.toLocaleString()}</li>}
            {filters.probability_min && <li>Min Probability: {filters.probability_min}%</li>}
            {filters.probability_max && <li>Max Probability: {filters.probability_max}%</li>}
            {filters.pipeline_ids && <li>Pipelines: {filters.pipeline_ids.length} selected</li>}
            {filters.stage_ids && <li>Stages: {filters.stage_ids.length} selected</li>}
            {filters.owner_ids && <li>Owners: {filters.owner_ids.length} selected</li>}
            {filters.time_restrictions?.business_hours_only && <li>Business hours only</li>}
            {filters.currencies && <li>Currencies: {filters.currencies.join(', ')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RuleFilters;