import { API_BASE_URL } from '../config/api';
import React, { useState, useEffect } from 'react';
import './TemplateEditor.css';

interface TemplateVariables {
  [category: string]: {
    [key: string]: string;
  };
}

interface TemplateData {
  template_mode: 'simple' | 'compact' | 'detailed' | 'custom';
  custom_template?: string | null;
}

interface TemplateEditorProps {
  value: TemplateData;
  onChange: (value: TemplateData) => void;
  eventType: string;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ value, onChange, eventType }) => {
  const [availableVariables, setAvailableVariables] = useState<TemplateVariables>({});
  const [defaultTemplates, setDefaultTemplates] = useState<{[key: string]: string}>({});
  const [previewData, setPreviewData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeVariableCategory, setActiveVariableCategory] = useState<string>('deal');

  useEffect(() => {
    loadTemplateData();
  }, []);

  useEffect(() => {
    generatePreview();
  }, [value, eventType]);

  const loadTemplateData = async () => {
    try {
      const apiUrl = API_BASE_URL;
      const response = await fetch(`${apiUrl}/api/v1/templates/variables`);
      
      if (response.ok) {
        const data = await response.json();
        setAvailableVariables(data.variables || mockVariables);
        setDefaultTemplates(data.templates || mockTemplates);
      } else {
        // Use mock data if API is not available
        setAvailableVariables(mockVariables);
        setDefaultTemplates(mockTemplates);
      }
    } catch (error) {
      console.error('Error loading template data:', error);
      setAvailableVariables(mockVariables);
      setDefaultTemplates(mockTemplates);
    }
    setIsLoading(false);
  };

  const generatePreview = async () => {
    try {
      const templateToPreview = value.template_mode === 'custom' 
        ? value.custom_template 
        : generateTemplateByMode(value.template_mode, eventType);

      // Generate preview with mock data
      const mockWebhookData = {
        event: eventType,
        current: {
          id: 123,
          title: 'Sample Deal - ACME Corp Integration',
          value: 25000,
          currency: 'USD',
          stage_name: eventType === 'deal.won' ? 'Won' : 'Proposal Made',
          status: eventType === 'deal.won' ? 'won' : 'open',
          probability: eventType === 'deal.won' ? 100 : 75,
          expected_close_date: '2024-12-31',
          owner_name: 'John Smith',
          add_time: '2024-01-15T10:30:00Z',
          stage_change_time: '2024-01-20T14:20:00Z'
        },
        user: {
          name: 'John Smith',
          email: 'john@company.com'
        },
        company_id: 12345,
        company_domain: 'your-company'
      };

      const preview = processTemplateMock(templateToPreview || 'No template available', mockWebhookData);
      setPreviewData(preview);
    } catch (error) {
      setPreviewData('Error generating preview');
    }
  };

  // Generate template based on mode
  const generateTemplateByMode = (mode: string, eventType: string): string => {
    const baseEvent = eventType.includes('deal') ? 'deal' : 'activity';
    
    switch (mode) {
      case 'simple':
        return baseEvent === 'deal' 
          ? `{deal.title} - {deal.stage}`
          : `{activity.subject} - {activity.type}`;
          
      case 'compact':
        return baseEvent === 'deal' 
          ? eventType === 'deal.won' 
            ? `🎉 Deal Won!\n📋 {deal.title}\n💰 {deal.value} 🏆\n👤 {deal.owner_name}`
            : `📋 {deal.title}\n💰 {deal.value} | 🎯 {deal.stage}\n👤 {deal.owner_name}`
          : `📅 {activity.subject}\n📝 {activity.type} | ⏰ {activity.due_date}\n👤 {activity.owner_name}`;
          
      case 'detailed':
        return baseEvent === 'deal' 
          ? `🎯 Deal Update: {deal.title}\n\n💰 Value: {deal.value}\n🎯 Stage: {deal.stage}\n📊 Probability: {deal.probability}\n👤 Owner: {deal.owner_name}\n📅 Updated: {event.timestamp}\n\n[View Deal]({deal.url})`
          : `📅 Activity: {activity.subject}\n\n📝 Type: {activity.type}\n⏰ Due: {activity.due_date} at {activity.due_time}\n📋 Note: {activity.note}\n👤 Owner: {activity.owner_name}\n\n[View Activity]({activity.url})`;
          
      default:
        return defaultTemplates[eventType] || defaultTemplates['deal.updated'] || 'No template available';
    }
  };

  // Mock template processing for preview
  const processTemplateMock = (template: string, data: any): string => {
    let processed = template;
    
    // Replace common variables with mock data
    const replacements: {[key: string]: string} = {
      '{deal.title}': data.current?.title || 'Sample Deal',
      '{deal.value}': `$${(data.current?.value || 0).toLocaleString()}`,
      '{deal.currency}': data.current?.currency || 'USD',
      '{deal.stage}': data.current?.stage_name || 'Qualified',
      '{deal.status}': data.current?.status || 'open',
      '{deal.probability}': `${data.current?.probability || 50}%`,
      '{deal.owner_name}': data.current?.owner_name || 'John Smith',
      '{event.timestamp}': new Date().toLocaleString(),
      '{deal.url}': `https://${data.company_domain || 'app'}.pipedrive.com/deal/${data.current?.id || 123}`,
      '{user.name}': data.user?.name || 'John Smith',
      '{person.name}': 'Jane Doe',
      '{person.company}': 'ACME Corporation',
      '{activity.subject}': 'Follow-up call',
      '{activity.type}': 'Call',
      '{org.name}': 'ACME Corporation'
    };

    Object.entries(replacements).forEach(([variable, value]) => {
      processed = processed.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return processed;
  };

  const handleTemplateChange = (newTemplateMode: TemplateData['template_mode']) => {
    if (newTemplateMode === 'custom') {
      onChange({
        template_mode: 'custom',
        custom_template: defaultTemplates[eventType] || defaultTemplates['deal.updated'] || ''
      });
    } else {
      onChange({
        template_mode: newTemplateMode,
        custom_template: null
      });
    }
  };

  const handleCustomTemplateChange = (newTemplate: string) => {
    onChange({
      ...value,
      custom_template: newTemplate
    });
  };

  const insertVariable = (variable: string) => {
    if (value.template_mode !== 'custom') return;

    const textarea = document.getElementById('custom-template') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentTemplate = value.custom_template || '';
    const newTemplate = currentTemplate.substring(0, start) + `{${variable}}` + currentTemplate.substring(end);
    
    handleCustomTemplateChange(newTemplate);

    // Restore cursor position
    setTimeout(() => {
      const newCursorPos = start + variable.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const loadPresetTemplate = (templateKey: string) => {
    if (defaultTemplates[templateKey]) {
      onChange({
        template_mode: 'custom',
        custom_template: defaultTemplates[templateKey]
      });
    }
  };

  if (isLoading) {
    return <div className="template-editor-loading">Loading template options...</div>;
  }

  return (
    <div className="template-editor">
      <div className="template-editor-header">
        <h4>Message Template</h4>
        <p>Customize how notifications appear in Google Chat</p>
      </div>

      <div className="template-mode-selector">
        <label>Template Type:</label>
        <div className="template-mode-options">
          <label className="template-option">
            <input
              type="radio"
              value="simple"
              checked={value.template_mode === 'simple'}
              onChange={(e) => handleTemplateChange(e.target.value as any)}
            />
            <span>Simple</span>
          </label>
          <label className="template-option">
            <input
              type="radio"
              value="compact"
              checked={value.template_mode === 'compact'}
              onChange={(e) => handleTemplateChange(e.target.value as any)}
            />
            <span>Compact</span>
          </label>
          <label className="template-option">
            <input
              type="radio"
              value="detailed"
              checked={value.template_mode === 'detailed'}
              onChange={(e) => handleTemplateChange(e.target.value as any)}
            />
            <span>Detailed</span>
          </label>
          <label className="template-option">
            <input
              type="radio"
              value="custom"
              checked={value.template_mode === 'custom'}
              onChange={(e) => handleTemplateChange(e.target.value as any)}
            />
            <span>Custom</span>
          </label>
        </div>
      </div>

      {value.template_mode === 'custom' && (
        <div className="custom-template-section">
          <div className="template-editor-content">
            <div className="template-input-section">
              <label htmlFor="custom-template">Custom Template:</label>
              <textarea
                id="custom-template"
                className="custom-template-input"
                value={value.custom_template || ''}
                onChange={(e) => handleCustomTemplateChange(e.target.value)}
                placeholder="Enter your custom template using variables like {deal.title}, {deal.value}, etc."
                rows={10}
              />
              
              <div className="template-actions">
                <div className="preset-templates">
                  <label>Quick Start:</label>
                  <div className="preset-buttons">
                    {Object.keys(defaultTemplates).slice(0, 4).map(key => (
                      <button
                        key={key}
                        type="button"
                        className="preset-button"
                        onClick={() => loadPresetTemplate(key)}
                        title={`Load ${key.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())} template`}
                      >
                        {key.replace('deal.', '').replace('.', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="variables-section">
              <h5>Available Variables</h5>
              <div className="variable-categories">
                {Object.keys(availableVariables).map(category => (
                  <button
                    key={category}
                    className={`category-tab ${activeVariableCategory === category ? 'active' : ''}`}
                    onClick={() => setActiveVariableCategory(category)}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
              
              <div className="variables-list">
                {availableVariables[activeVariableCategory] && 
                 Object.entries(availableVariables[activeVariableCategory]).map(([variable, description]) => (
                  <div key={variable} className="variable-item">
                    <button
                      className="variable-button"
                      onClick={() => insertVariable(variable)}
                      title={description}
                    >
                      {variable}
                    </button>
                    <span className="variable-description">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="template-preview">
        <h5>Preview</h5>
        <div className="preview-content">
          <div className="google-chat-preview">
            <div className="chat-message">
              <div className="chat-avatar">PD</div>
              <div className="chat-content">
                <div className="chat-header">
                  <span className="chat-sender">Pipedrive Notifications</span>
                  <span className="chat-time">now</span>
                </div>
                <div className="chat-text">
                  {previewData.split('\n').map((line, index) => (
                    <div key={index} className="chat-line">
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock data for when API is not available
const mockVariables: TemplateVariables = {
  deal: {
    'deal.title': 'Deal title/name',
    'deal.value': 'Deal value with currency',
    'deal.currency': 'Deal currency code',
    'deal.stage': 'Current pipeline stage',
    'deal.status': 'Deal status (open/won/lost)',
    'deal.probability': 'Win probability percentage',
    'deal.expected_close_date': 'Expected close date',
    'deal.owner_name': 'Deal owner name',
    'deal.created_date': 'Deal creation date',
    'deal.days_in_stage': 'Days in current stage',
    'deal.url': 'Direct link to deal in Pipedrive'
  },
  person: {
    'person.name': 'Full name',
    'person.first_name': 'First name',
    'person.last_name': 'Last name',
    'person.email': 'Primary email address',
    'person.phone': 'Primary phone number',
    'person.company': 'Company name',
    'person.title': 'Job title',
    'person.owner_name': 'Person owner name',
    'person.url': 'Direct link to person in Pipedrive'
  },
  organization: {
    'org.name': 'Organization name',
    'org.owner_name': 'Organization owner name',
    'org.address': 'Organization address',
    'org.people_count': 'Number of people',
    'org.deals_count': 'Number of deals',
    'org.url': 'Direct link to organization in Pipedrive'
  },
  activity: {
    'activity.subject': 'Activity subject',
    'activity.type': 'Activity type',
    'activity.due_date': 'Due date',
    'activity.due_time': 'Due time',
    'activity.duration': 'Duration',
    'activity.note': 'Activity note',
    'activity.owner_name': 'Activity owner name',
    'activity.url': 'Direct link to activity in Pipedrive'
  },
  user: {
    'user.name': 'User who triggered the event',
    'user.email': 'User email address'
  },
  system: {
    'event.type': 'Webhook event type',
    'event.timestamp': 'Event timestamp',
    'company.name': 'Pipedrive company name'
  }
};

const mockTemplates: {[key: string]: string} = {
  'deal.added': `🎯 New Deal Created!
📋 **{deal.title}** 
💰 Value: {deal.value}
👤 Owner: {deal.owner_name}
🎯 Stage: {deal.stage}
📅 Created: {event.timestamp}

[View Deal]({deal.url})`,

  'deal.updated': `📈 Deal Updated: {deal.title}
💰 Value: {deal.value} 
🎯 Stage: {deal.stage}
📊 Probability: {deal.probability}%
👤 Owner: {deal.owner_name}

[View Deal]({deal.url})`,

  'deal.won': `🎉 Deal Won! 
📋 **{deal.title}**
💰 **{deal.value}** 🏆
👤 Owner: {deal.owner_name}
📅 Closed: {event.timestamp}

[View Deal]({deal.url})`,

  'deal.lost': `📉 Deal Lost
📋 {deal.title}
💰 Value: {deal.value}
👤 Owner: {deal.owner_name}
📅 Lost: {event.timestamp}

[View Deal]({deal.url})`
};

export default TemplateEditor;