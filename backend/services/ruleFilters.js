const { Pool } = require('pg');

/**
 * Advanced rule filtering service for value-based and probability-based filtering
 * Supports deal value thresholds, probability ranges, custom fields, and tags
 */

// Deal value filtering
function checkValueFilter(webhookData, filter) {
  const dealValue = parseFloat(webhookData.current?.value || webhookData.object?.value || 0);
  
  if (filter.value_min && dealValue < filter.value_min) {
    return false;
  }
  
  if (filter.value_max && dealValue > filter.value_max) {
    return false;
  }
  
  return true;
}

// Deal probability filtering
function checkProbabilityFilter(webhookData, filter) {
  const probability = parseInt(webhookData.current?.probability || webhookData.object?.probability || 0);
  
  if (filter.probability_min && probability < filter.probability_min) {
    return false;
  }
  
  if (filter.probability_max && probability > filter.probability_max) {
    return false;
  }
  
  return true;
}

// Stage-based filtering
function checkStageFilter(webhookData, filter) {
  const stageId = webhookData.current?.stage_id || webhookData.object?.stage_id;
  
  if (filter.stage_ids && Array.isArray(filter.stage_ids)) {
    return filter.stage_ids.includes(stageId);
  }
  
  return true;
}

// Pipeline filtering
function checkPipelineFilter(webhookData, filter) {
  const pipelineId = webhookData.current?.pipeline_id || webhookData.object?.pipeline_id;
  
  if (filter.pipeline_ids && Array.isArray(filter.pipeline_ids)) {
    return filter.pipeline_ids.includes(pipelineId);
  }
  
  return true;
}

// Owner/user filtering
function checkOwnerFilter(webhookData, filter) {
  const ownerId = webhookData.current?.user_id || webhookData.object?.user_id || webhookData.user_id;
  
  if (filter.owner_ids && Array.isArray(filter.owner_ids)) {
    return filter.owner_ids.includes(ownerId);
  }
  
  return true;
}

// Time-based filtering (business hours)
function checkTimeFilter(webhookData, filter) {
  if (!filter.time_restrictions) return true;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check business hours
  if (filter.time_restrictions.business_hours_only) {
    const startHour = filter.time_restrictions.start_hour || 9;
    const endHour = filter.time_restrictions.end_hour || 17;
    
    if (currentHour < startHour || currentHour >= endHour) {
      return false;
    }
    
    // Check weekdays only
    if (filter.time_restrictions.weekdays_only) {
      if (currentDay === 0 || currentDay === 6) { // Sunday or Saturday
        return false;
      }
    }
  }
  
  return true;
}

// Label/tag filtering (if deal has custom labels)
function checkLabelFilter(webhookData, filter) {
  if (!filter.labels || !Array.isArray(filter.labels)) return true;
  
  const dealLabels = webhookData.current?.label || webhookData.object?.label || [];
  
  // Check if deal has any of the required labels
  if (filter.label_match_type === 'any') {
    return filter.labels.some(label => dealLabels.includes(label));
  }
  
  // Check if deal has all required labels
  if (filter.label_match_type === 'all') {
    return filter.labels.every(label => dealLabels.includes(label));
  }
  
  return true;
}

// Currency filtering
function checkCurrencyFilter(webhookData, filter) {
  if (!filter.currencies || !Array.isArray(filter.currencies)) return true;
  
  const currency = webhookData.current?.currency || webhookData.object?.currency || 'USD';
  return filter.currencies.includes(currency);
}

// Main filtering function that applies all filters
function applyAdvancedFilters(webhookData, rule) {
  try {
    // Parse filters if it's a string
    let filters = rule.filters;
    if (typeof filters === 'string') {
      try {
        filters = JSON.parse(filters);
      } catch (error) {
        console.error('Error parsing rule filters:', error);
        return true; // Default to match if filters can't be parsed
      }
    }
    
    if (!filters || Object.keys(filters).length === 0) {
      return true; // No filters means match all
    }
    
    console.log(`🔍 Applying advanced filters for rule ${rule.name}:`, JSON.stringify(filters, null, 2));
    
    // Apply all filter checks
    const checks = [
      checkValueFilter(webhookData, filters),
      checkProbabilityFilter(webhookData, filters),
      checkStageFilter(webhookData, filters),
      checkPipelineFilter(webhookData, filters),
      checkOwnerFilter(webhookData, filters),
      checkTimeFilter(webhookData, filters),
      checkLabelFilter(webhookData, filters),
      checkCurrencyFilter(webhookData, filters)
    ];
    
    // All checks must pass
    const result = checks.every(check => check === true);
    
    console.log(`🎯 Filter result for rule ${rule.name}: ${result ? 'MATCH' : 'NO MATCH'}`);
    
    return result;
    
  } catch (error) {
    console.error('Error applying advanced filters:', error);
    return true; // Default to match if there's an error
  }
}

// Helper function to validate filter configuration
function validateFilters(filters) {
  const errors = [];
  
  if (filters.value_min && filters.value_max && filters.value_min > filters.value_max) {
    errors.push('value_min cannot be greater than value_max');
  }
  
  if (filters.probability_min && filters.probability_max && filters.probability_min > filters.probability_max) {
    errors.push('probability_min cannot be greater than probability_max');
  }
  
  if (filters.probability_min && (filters.probability_min < 0 || filters.probability_min > 100)) {
    errors.push('probability_min must be between 0 and 100');
  }
  
  if (filters.probability_max && (filters.probability_max < 0 || filters.probability_max > 100)) {
    errors.push('probability_max must be between 0 and 100');
  }
  
  if (filters.time_restrictions?.start_hour && 
      (filters.time_restrictions.start_hour < 0 || filters.time_restrictions.start_hour > 23)) {
    errors.push('start_hour must be between 0 and 23');
  }
  
  if (filters.time_restrictions?.end_hour && 
      (filters.time_restrictions.end_hour < 0 || filters.time_restrictions.end_hour > 23)) {
    errors.push('end_hour must be between 0 and 23');
  }
  
  return errors;
}

// Helper function to create common filter presets
function createFilterPreset(presetName) {
  const presets = {
    'high_value_deals': {
      value_min: 10000,
      description: 'Deals worth $10,000 or more'
    },
    'hot_prospects': {
      probability_min: 80,
      description: 'Deals with 80%+ probability'
    },
    'big_deals_hot_prospects': {
      value_min: 5000,
      probability_min: 70,
      description: 'High-value deals with good probability'
    },
    'business_hours_only': {
      time_restrictions: {
        business_hours_only: true,
        start_hour: 9,
        end_hour: 17,
        weekdays_only: true
      },
      description: 'Only during business hours (9 AM - 5 PM, weekdays)'
    },
    'urgent_deals': {
      stage_ids: [], // Will need to be populated based on pipeline
      probability_min: 90,
      description: 'High-probability deals in closing stages'
    }
  };
  
  return presets[presetName] || null;
}

// Function to get filter statistics for a tenant
async function getFilterStats(tenantId, pool) {
  try {
    const query = `
      SELECT 
        r.id,
        r.name,
        r.filters,
        COUNT(l.id) as notification_count,
        COUNT(CASE WHEN l.status = 'success' THEN 1 END) as success_count
      FROM rules r
      LEFT JOIN logs l ON r.id = l.rule_id AND l.created_at >= NOW() - INTERVAL '30 days'
      WHERE r.tenant_id = $1 AND r.enabled = true
      GROUP BY r.id, r.name, r.filters
      ORDER BY notification_count DESC
    `;
    
    const result = await pool.query(query, [tenantId]);
    
    return result.rows.map(row => ({
      rule_id: row.id,
      rule_name: row.name,
      filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      notifications_last_30_days: parseInt(row.notification_count),
      success_rate: row.notification_count > 0 
        ? Math.round((row.success_count / row.notification_count) * 100) 
        : 0
    }));
    
  } catch (error) {
    console.error('Error getting filter stats:', error);
    return [];
  }
}

module.exports = {
  applyAdvancedFilters,
  validateFilters,
  createFilterPreset,
  getFilterStats
};