/**
 * Custom Template Engine with Variable Substitution
 * Supports dynamic content generation for notifications
 */

/**
 * Available template variables for different Pipedrive objects
 */
const TEMPLATE_VARIABLES = {
  // Deal variables
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
    'deal.last_activity': 'Last activity date',
    'deal.days_in_stage': 'Days in current stage',
    'deal.url': 'Direct link to deal in Pipedrive'
  },
  
  // Person variables
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
  
  // Organization variables
  organization: {
    'org.name': 'Organization name',
    'org.owner_name': 'Organization owner name',
    'org.address': 'Organization address',
    'org.people_count': 'Number of people',
    'org.deals_count': 'Number of deals',
    'org.url': 'Direct link to organization in Pipedrive'
  },
  
  // Activity variables
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
  
  // User/Event variables
  user: {
    'user.name': 'User who triggered the event',
    'user.email': 'User email address'
  },
  
  // System variables
  system: {
    'event.type': 'Webhook event type',
    'event.timestamp': 'Event timestamp',
    'company.name': 'Pipedrive company name'
  }
};

/**
 * Default templates for different event types
 */
const DEFAULT_TEMPLATES = {
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

  'deal.won': `🎉 *Deal Won!* 🏆

📋 *{deal.title}*
💰 *{deal.value}*
🎯 Stage: {deal.stage}
👤 Owner: {deal.owner_name}
📅 Closed: {event.timestamp}

[View Deal]({deal.url})`,

  'deal.lost': `📉 Deal Lost
📋 {deal.title}
💰 Value: {deal.value}
👤 Owner: {deal.owner_name}
📅 Lost: {event.timestamp}

[View Deal]({deal.url})`,

  'person.added': `👤 New Contact Added
📋 **{person.name}**
🏢 Company: {person.company}
💼 Title: {person.title}
📧 Email: {person.email}
📞 Phone: {person.phone}

[View Contact]({person.url})`,

  'activity.added': `📅 New Activity: {activity.subject}
🔄 Type: {activity.type}
📅 Due: {activity.due_date} at {activity.due_time}
👤 Owner: {activity.owner_name}
⏰ Duration: {activity.duration}

[View Activity]({activity.url})`
};

/**
 * Process template with variable substitution
 * @param {string} template - Template string with variables in {variable.name} format
 * @param {Object} webhookData - Webhook data for variable extraction
 * @param {Object} options - Processing options
 * @returns {string} Processed template with variables substituted
 */
function processTemplate(template, webhookData, options = {}) {
  try {
    const { 
      format = 'text', // 'text' | 'markdown' | 'html'
      fallbackValues = {},
      strictMode = false,
      timezone = 'UTC'
    } = options;
    
    // Extract variables from webhook data
    const variables = extractVariables(webhookData, { timezone });
    
    // Add fallback values
    Object.assign(variables, fallbackValues);
    
    // Replace variables in template
    let processedTemplate = template;
    
    // Find all template variables {variable.name}
    const variableRegex = /\{([^}]+)\}/g;
    const matches = [...template.matchAll(variableRegex)];
    
    for (const match of matches) {
      const fullMatch = match[0]; // {variable.name}
      const variableName = match[1]; // variable.name
      
      let value = getVariableValue(variables, variableName);
      
      if (value === null || value === undefined) {
        if (strictMode) {
          throw new Error(`Template variable '${variableName}' not found`);
        }
        // Use fallback or empty string
        value = fallbackValues[variableName] || `{${variableName}}`;
      }
      
      // Format value based on variable type and output format
      const formattedValue = formatValue(value, variableName, format);
      
      // Replace the variable
      processedTemplate = processedTemplate.replace(fullMatch, formattedValue);
    }
    
    // Apply format-specific processing
    if (format === 'markdown') {
      processedTemplate = processMarkdown(processedTemplate);
    } else if (format === 'html') {
      processedTemplate = processHtml(processedTemplate);
    }
    
    return processedTemplate;
    
  } catch (error) {
    console.error('Template processing error:', error);
    return `Error processing template: ${error.message}`;
  }
}

/**
 * Extract variables from webhook data
 * @param {Object} webhookData - Webhook data
 * @param {Object} options - Options including timezone
 * @returns {Object} Extracted variables
 */
function extractVariables(webhookData, options = {}) {
  const variables = {};
  const { event, object, current, previous, user, company } = webhookData;
  
  // System variables
  variables['event.type'] = event;
  variables['event.timestamp'] = new Date().toLocaleString('en-US', { timeZone: options.timezone || 'UTC' });
  variables['company.name'] = company?.name || 'Pipedrive';
  
  // User variables
  if (user) {
    variables['user.name'] = user.name;
    variables['user.email'] = user.email;
  }
  
  // Determine object type and extract relevant variables
  const objectData = current || object || {};
  
  if (event?.includes('deal') || objectData.id) {
    extractDealVariables(variables, objectData, webhookData);
  }
  
  if (event?.includes('person') || objectData.name) {
    extractPersonVariables(variables, objectData, webhookData);
  }
  
  if (event?.includes('organization') || objectData.people_count !== undefined) {
    extractOrganizationVariables(variables, objectData, webhookData);
  }
  
  if (event?.includes('activity') || objectData.subject) {
    extractActivityVariables(variables, objectData, webhookData);
  }
  
  return variables;
}

/**
 * Extract deal-specific variables
 */
function extractDealVariables(variables, dealData, webhookData) {
  const deal = dealData;
  
  variables['deal.title'] = deal.title || 'Untitled Deal';
  variables['deal.value'] = formatCurrency(deal.value, deal.currency);
  variables['deal.currency'] = deal.currency || 'USD';
  variables['deal.stage'] = deal.stage_name || deal.pipeline_name || 'Unknown Stage';
  variables['deal.status'] = deal.status || 'open';
  variables['deal.probability'] = deal.probability || 0;
  variables['deal.expected_close_date'] = formatDate(deal.expected_close_date);
  variables['deal.owner_name'] = deal.owner_name || deal.user?.name || 'Unknown';
  variables['deal.created_date'] = formatDate(deal.add_time);
  variables['deal.last_activity'] = formatDate(deal.last_activity_date);
  
  // Calculate days in stage
  if (deal.stage_change_time) {
    const stageDate = new Date(deal.stage_change_time);
    const daysDiff = Math.floor((Date.now() - stageDate.getTime()) / (1000 * 60 * 60 * 24));
    variables['deal.days_in_stage'] = daysDiff;
  } else {
    variables['deal.days_in_stage'] = 0;
  }
  
  // Generate Pipedrive URL
  if (deal.id && webhookData.company_id) {
    variables['deal.url'] = `https://${webhookData.company_domain || 'app'}.pipedrive.com/deal/${deal.id}`;
  } else {
    variables['deal.url'] = 'https://app.pipedrive.com';
  }
}

/**
 * Extract person-specific variables
 */
function extractPersonVariables(variables, personData, webhookData) {
  const person = personData;
  
  variables['person.name'] = person.name || 'Unknown Person';
  variables['person.first_name'] = person.first_name || '';
  variables['person.last_name'] = person.last_name || '';
  variables['person.email'] = getFirstEmail(person.email) || '';
  variables['person.phone'] = getFirstPhone(person.phone) || '';
  variables['person.company'] = person.org_name || person.organization?.name || '';
  variables['person.title'] = person.job_title || '';
  variables['person.owner_name'] = person.owner_name || person.user?.name || 'Unknown';
  
  // Generate Pipedrive URL
  if (person.id && webhookData.company_id) {
    variables['person.url'] = `https://${webhookData.company_domain || 'app'}.pipedrive.com/person/${person.id}`;
  } else {
    variables['person.url'] = 'https://app.pipedrive.com';
  }
}

/**
 * Extract organization-specific variables
 */
function extractOrganizationVariables(variables, orgData, webhookData) {
  const org = orgData;
  
  variables['org.name'] = org.name || 'Unknown Organization';
  variables['org.owner_name'] = org.owner_name || org.user?.name || 'Unknown';
  variables['org.address'] = formatAddress(org.address) || '';
  variables['org.people_count'] = org.people_count || 0;
  variables['org.deals_count'] = org.deals_count || 0;
  
  // Generate Pipedrive URL
  if (org.id && webhookData.company_id) {
    variables['org.url'] = `https://${webhookData.company_domain || 'app'}.pipedrive.com/organization/${org.id}`;
  } else {
    variables['org.url'] = 'https://app.pipedrive.com';
  }
}

/**
 * Extract activity-specific variables
 */
function extractActivityVariables(variables, activityData, webhookData) {
  const activity = activityData;
  
  variables['activity.subject'] = activity.subject || 'Untitled Activity';
  variables['activity.type'] = activity.type || 'Activity';
  variables['activity.due_date'] = formatDate(activity.due_date);
  variables['activity.due_time'] = formatTime(activity.due_time);
  variables['activity.duration'] = formatDuration(activity.duration);
  variables['activity.note'] = activity.note || '';
  variables['activity.owner_name'] = activity.owner_name || activity.user?.name || 'Unknown';
  
  // Generate Pipedrive URL
  if (activity.id && webhookData.company_id) {
    variables['activity.url'] = `https://${webhookData.company_domain || 'app'}.pipedrive.com/activity/${activity.id}`;
  } else {
    variables['activity.url'] = 'https://app.pipedrive.com';
  }
}

/**
 * Get variable value using dot notation
 */
function getVariableValue(variables, variableName) {
  return variables[variableName] || null;
}

/**
 * Format value based on type and output format
 */
function formatValue(value, variableName, format) {
  if (value === null || value === undefined) return '';
  
  // Handle different value types
  if (variableName.includes('date') || variableName.includes('timestamp')) {
    return formatDate(value);
  }
  
  if (variableName.includes('value') && variableName.includes('deal')) {
    return String(value); // Already formatted by extractDealVariables
  }
  
  if (variableName.includes('url') && format === 'markdown') {
    return value; // URLs handled by markdown processor
  }
  
  return String(value);
}

/**
 * Utility functions for formatting
 */
function formatCurrency(value, currency = 'USD') {
  if (!value || isNaN(value)) return '$0';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  return formatter.format(value);
}

function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function formatTime(timeString) {
  if (!timeString) return '';
  
  try {
    // Handle HH:MM format
    if (typeof timeString === 'string' && timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return timeString;
  } catch {
    return timeString;
  }
}

function formatDuration(duration) {
  if (!duration) return '';
  
  // Convert minutes to human readable format
  if (typeof duration === 'number') {
    if (duration < 60) {
      return `${duration}m`;
    } else {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }
  
  return String(duration);
}

function formatAddress(address) {
  if (!address) return '';
  
  if (typeof address === 'object') {
    const parts = [
      address.street_number,
      address.route,
      address.locality,
      address.admin_area_level_1,
      address.postal_code,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }
  
  return String(address);
}

function getFirstEmail(emailData) {
  if (!emailData) return '';
  
  if (Array.isArray(emailData)) {
    return emailData.length > 0 ? emailData[0].value : '';
  }
  
  if (typeof emailData === 'object' && emailData.value) {
    return emailData.value;
  }
  
  return String(emailData);
}

function getFirstPhone(phoneData) {
  if (!phoneData) return '';
  
  if (Array.isArray(phoneData)) {
    return phoneData.length > 0 ? phoneData[0].value : '';
  }
  
  if (typeof phoneData === 'object' && phoneData.value) {
    return phoneData.value;
  }
  
  return String(phoneData);
}

function processMarkdown(text) {
  // Convert markdown to more readable text format for Google Chat
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
    .replace(/\*(.*?)\*/g, '_$1_')     // Italic
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2'); // Links
}

function processHtml(text) {
  // Convert basic markdown to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>');
}

/**
 * Get default template for event type
 */
function getDefaultTemplate(eventType) {
  return DEFAULT_TEMPLATES[eventType] || DEFAULT_TEMPLATES['deal.updated'];
}

/**
 * Validate template syntax
 */
function validateTemplate(template) {
  const errors = [];
  
  if (!template || typeof template !== 'string') {
    errors.push('Template must be a non-empty string');
    return { valid: false, errors };
  }
  
  // Check for unclosed variables
  const openBraces = (template.match(/\{/g) || []).length;
  const closeBraces = (template.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push('Unmatched braces in template variables');
  }
  
  // Check for valid variable names
  const variableRegex = /\{([^}]+)\}/g;
  const matches = [...template.matchAll(variableRegex)];
  
  for (const match of matches) {
    const variableName = match[1];
    
    if (!variableName.includes('.')) {
      errors.push(`Invalid variable format: '${variableName}'. Use dot notation like 'deal.title'`);
    }
    
    // Check if variable exists in our predefined list
    const isValidVariable = Object.values(TEMPLATE_VARIABLES).some(group => 
      Object.keys(group).includes(variableName)
    );
    
    if (!isValidVariable) {
      errors.push(`Unknown variable: '${variableName}'. Check available variables.`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get available template variables for documentation
 */
function getAvailableVariables() {
  return TEMPLATE_VARIABLES;
}

module.exports = {
  processTemplate,
  getDefaultTemplate,
  validateTemplate,
  getAvailableVariables,
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLES
};