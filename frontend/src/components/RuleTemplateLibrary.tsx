import React, { useState, useEffect } from 'react';
import './RuleTemplateLibrary.css';
import { API_BASE_URL } from '../config/api';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  event_type: string;
  customization: Record<string, any>;
  preview: {
    title: string;
    description: string;
  };
  requirements?: string[];
  available?: boolean;
}

interface TemplateCategory {
  name: string;
  displayName: string;
  count: number;
}

interface RuleTemplateLibraryProps {
  onApplyTemplate: (templateId: string, customization: Record<string, any>) => void;
  planTier: string;
}

const RuleTemplateLibrary: React.FC<RuleTemplateLibraryProps> = ({ onApplyTemplate, planTier = 'free' }) => {
  const { hasFeature } = usePlanFeatures();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [customization, setCustomization] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [planTier, selectedCategory]);

  const loadTemplates = async () => {
    try {
      const params = new URLSearchParams({
        plan_tier: planTier,
        ...(selectedCategory && { category: selectedCategory })
      });
      
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/library?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/library/categories?plan_tier=${planTier}`);
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleTemplateSelect = (template: RuleTemplate) => {
    setSelectedTemplate(template);
    // Initialize customization with defaults
    const defaultCustomization: Record<string, any> = {};
    Object.entries(template.customization || {}).forEach(([key, config]: [string, any]) => {
      defaultCustomization[key] = config.default;
    });
    setCustomization(defaultCustomization);
    setShowModal(true);
  };

  const handleCustomizationChange = (key: string, value: any) => {
    setCustomization(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    
    setApplying(true);
    try {
      await onApplyTemplate(selectedTemplate.id, customization);
      setShowModal(false);
      setSelectedTemplate(null);
      setCustomization({});
    } catch (error) {
      console.error('Error applying template:', error);
    } finally {
      setApplying(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'green';
      case 'intermediate': return 'orange';
      case 'advanced': return 'red';
      default: return 'gray';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      sales: '💰',
      celebrations: '🎉',
      monitoring: '👀',
      assignments: '📋',
      pipeline: '📊',
      executive: '🎯',
      analysis: '📈',
      reporting: '📑'
    };
    return icons[category] || '📄';
  };

  const renderCustomizationField = (key: string, config: any) => {
    switch (config.type) {
      case 'number':
        return (
          <div key={key} className="customization-field">
            <label>{config.description}</label>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={customization[key] || config.default}
              onChange={(e) => handleCustomizationChange(key, parseInt(e.target.value))}
            />
          </div>
        );
        
      case 'text':
        return (
          <div key={key} className="customization-field">
            <label>{config.description}</label>
            <input
              type="text"
              value={customization[key] || config.default}
              onChange={(e) => handleCustomizationChange(key, e.target.value)}
            />
          </div>
        );
        
      case 'select':
        return (
          <div key={key} className="customization-field">
            <label>{config.description}</label>
            <select
              value={customization[key] || config.default}
              onChange={(e) => handleCustomizationChange(key, e.target.value)}
            >
              {config.options.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="template-library-loading">Loading templates...</div>;
  }

  return (
    <div className="rule-template-library">
      <div className="template-library-header">
        <h3>Rule Templates Library</h3>
        <p>Choose from pre-built templates to quickly set up common notification patterns.</p>
      </div>

      <div className="template-filters">
        <div className="category-filter">
          <button
            className={`category-btn ${selectedCategory === '' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('')}
          >
            All Templates ({templates.length})
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.name)}
            >
              {getCategoryIcon(category.name)} {category.displayName} ({category.count})
            </button>
          ))}
        </div>
      </div>

      <div className="templates-grid">
        {templates.map((template) => {
          const canUseTemplate = hasFeature('rule_templates');
          const isLocked = !template.available || !canUseTemplate;
          return (
          <div key={template.id} className={`template-card ${isLocked ? 'locked' : ''}`}>
            <div className="template-header">
              <div className="template-category">
                {getCategoryIcon(template.category)} {template.category}
              </div>
              <div className={`difficulty-badge ${template.difficulty}`}>
                {template.difficulty}
              </div>
            </div>
            
            <h4>{template.name}</h4>
            <p className="template-description">{template.description}</p>
            
            <div className="template-details">
              <div className="event-type">Event: <code>{template.event_type}</code></div>
            </div>

            {isLocked && (
              <div className="template-requirements">
                <span className="lock-icon">🔒</span>
                {!hasFeature('rule_templates') ? 'Requires Pro+ plan' : `Requires: ${template.requirements?.join(', ')} plan`}
              </div>
            )}
            
            <div className="template-actions">
              <button
                className="template-btn preview-btn"
                onClick={() => handleTemplateSelect(template)}
                disabled={isLocked}
              >
                {!isLocked ? 'Customize & Apply' : 'Locked'}
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="no-templates">
          <p>No templates available for the selected category.</p>
        </div>
      )}

      {/* Template Customization Modal */}
      {showModal && selectedTemplate && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTemplate.name}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="template-preview">
                <h4>Preview</h4>
                <div className="preview-content">
                  <h5>{selectedTemplate.preview.title}</h5>
                  <p>{selectedTemplate.preview.description}</p>
                </div>
              </div>

              {Object.keys(selectedTemplate.customization || {}).length > 0 && (
                <div className="template-customization">
                  <h4>Customization</h4>
                  <div className="customization-fields">
                    {Object.entries(selectedTemplate.customization || {}).map(([key, config]) =>
                      renderCustomizationField(key, config)
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={applying}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleApplyTemplate}
                disabled={applying}
              >
                {applying ? 'Applying...' : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleTemplateLibrary;