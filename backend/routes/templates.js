const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { validateTemplate, getAvailableVariables, DEFAULT_TEMPLATES } = require('../services/templateEngine');
const { requireFeature } = require('../middleware/featureGating');
const { 
  getRuleTemplates, 
  getRuleTemplate, 
  applyTemplateCustomization, 
  getTemplatesByCategory,
  getTemplateCategories 
} = require('../config/ruleTemplates');

/**
 * GET /api/v1/templates/variables
 * Get available template variables for documentation
 */
router.get('/variables', async (req, res) => {
  try {
    const variables = getAvailableVariables();
    
    res.json({
      success: true,
      variables,
      total_variables: Object.values(variables).reduce((sum, group) => sum + Object.keys(group).length, 0)
    });
    
  } catch (error) {
    console.error('Error getting template variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template variables'
    });
  }
});

/**
 * GET /api/v1/templates/defaults
 * Get default templates for different event types
 */
router.get('/defaults', async (req, res) => {
  try {
    const { event_type } = req.query;
    
    if (event_type && DEFAULT_TEMPLATES[event_type]) {
      res.json({
        success: true,
        template: {
          event_type,
          content: DEFAULT_TEMPLATES[event_type]
        }
      });
    } else {
      res.json({
        success: true,
        templates: Object.entries(DEFAULT_TEMPLATES).map(([event, content]) => ({
          event_type: event,
          content
        })),
        total: Object.keys(DEFAULT_TEMPLATES).length
      });
    }
    
  } catch (error) {
    console.error('Error getting default templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get default templates'
    });
  }
});

/**
 * POST /api/v1/templates/validate
 * Validate template syntax and variables
 */
router.post('/validate', async (req, res) => {
  try {
    const { template_content } = req.body;
    
    if (!template_content) {
      return res.status(400).json({
        success: false,
        error: 'template_content is required'
      });
    }
    
    const validation = validateTemplate(template_content);
    
    res.json({
      success: true,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        error_count: validation.errors.length
      }
    });
    
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate template'
    });
  }
});

/**
 * GET /api/v1/templates/library
 * Get all rule templates from library (filtered by plan tier)
 */
router.get('/library', async (req, res) => {
  try {
    const { plan_tier = 'free', category } = req.query;
    
    let templates;
    if (category) {
      templates = getTemplatesByCategory(category, plan_tier);
    } else {
      templates = getRuleTemplates(plan_tier);
    }
    
    res.json({
      success: true,
      templates,
      total: templates.length,
      plan_tier,
      ...(category && { category })
    });
    
  } catch (error) {
    console.error('Error getting rule templates library:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule templates library'
    });
  }
});

/**
 * GET /api/v1/templates/library/categories
 * Get all template categories with counts
 */
router.get('/library/categories', async (req, res) => {
  try {
    const { plan_tier = 'free' } = req.query;
    
    const categories = getTemplateCategories(plan_tier);
    
    res.json({
      success: true,
      categories,
      total: categories.length,
      plan_tier
    });
    
  } catch (error) {
    console.error('Error getting template categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template categories'
    });
  }
});

/**
 * GET /api/v1/templates/library/:templateId
 * Get specific template from library
 */
router.get('/library/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = getRuleTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        template_id: templateId
      });
    }
    
    res.json({
      success: true,
      template
    });
    
  } catch (error) {
    console.error('Error getting rule template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule template'
    });
  }
});

/**
 * POST /api/v1/templates/library/:templateId/apply
 * Apply template with customization to create a rule
 */
router.post('/library/:templateId/apply', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { customization = {}, tenant_id, webhook_id } = req.body;
    
    // Validate required fields
    if (!tenant_id || !webhook_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id and webhook_id are required'
      });
    }
    
    // Get the template
    const template = getRuleTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        template_id: templateId
      });
    }
    
    // Apply customization
    const ruleConfig = applyTemplateCustomization(template, customization);
    
    // Create the rule in database
    const result = await pool.query(`
      INSERT INTO rules (
        tenant_id, name, event_type, filters, target_webhook_id,
        template_mode, custom_template, enabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      tenant_id,
      ruleConfig.name,
      ruleConfig.event_type,
      JSON.stringify(ruleConfig.filters),
      webhook_id,
      ruleConfig.template_config.template_mode,
      ruleConfig.template_config.custom_template,
      ruleConfig.enabled
    ]);
    
    const createdRule = result.rows[0];
    
    res.json({
      success: true,
      message: 'Template applied successfully',
      rule: {
        id: createdRule.id,
        name: createdRule.name,
        event_type: createdRule.event_type,
        filters: createdRule.filters,
        enabled: createdRule.enabled,
        template_mode: createdRule.template_mode,
        custom_template: createdRule.custom_template
      },
      template_id: templateId,
      applied_customization: customization
    });
    
  } catch (error) {
    console.error('Error applying rule template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply rule template'
    });
  }
});

/**
 * GET /api/v1/templates/presets/:tenantId
 * Get template presets for a tenant
 */
router.get('/presets/:tenantId', requireFeature('custom_templates'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { event_type, active_only = 'true' } = req.query;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    let query = `
      SELECT 
        id,
        name,
        description,
        event_types,
        template_content,
        template_format,
        is_active,
        created_at,
        updated_at
      FROM template_presets 
      WHERE tenant_id = $1
    `;
    
    const queryParams = [tenantId];
    
    // Filter by event type if specified
    if (event_type) {
      query += ` AND $${queryParams.length + 1} = ANY(event_types)`;
      queryParams.push(event_type);
    }
    
    // Filter by active status
    if (active_only === 'true') {
      query += ' AND is_active = true';
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      presets: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error getting template presets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template presets'
    });
  }
});

/**
 * POST /api/v1/templates/presets/:tenantId
 * Create a new template preset
 */
router.post('/presets/:tenantId', requireFeature('custom_templates'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { 
      name, 
      description, 
      event_types, 
      template_content, 
      template_format = 'text' 
    } = req.body;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID'
      });
    }
    
    // Validate required fields
    if (!name || !event_types || !template_content) {
      return res.status(400).json({
        success: false,
        error: 'name, event_types, and template_content are required'
      });
    }
    
    // Validate event_types is array
    if (!Array.isArray(event_types) || event_types.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'event_types must be a non-empty array'
      });
    }
    
    // Validate template content
    const validation = validateTemplate(template_content);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template content',
        validation_errors: validation.errors
      });
    }
    
    // Check for duplicate name
    const existingCheck = await pool.query(
      'SELECT id FROM template_presets WHERE tenant_id = $1 AND name = $2',
      [tenantId, name]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Template preset with this name already exists'
      });
    }
    
    // Create the preset
    const result = await pool.query(`
      INSERT INTO template_presets (
        tenant_id, 
        name, 
        description, 
        event_types, 
        template_content, 
        template_format
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenantId, name, description, event_types, template_content, template_format]);
    
    res.status(201).json({
      success: true,
      preset: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating template preset:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({
        success: false,
        error: 'Template preset with this name already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create template preset'
      });
    }
  }
});

/**
 * PUT /api/v1/templates/presets/:tenantId/:presetId
 * Update a template preset
 */
router.put('/presets/:tenantId/:presetId', requireFeature('custom_templates'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const presetId = parseInt(req.params.presetId);
    const { 
      name, 
      description, 
      event_types, 
      template_content, 
      template_format,
      is_active 
    } = req.body;
    
    if (isNaN(tenantId) || isNaN(presetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID or preset ID'
      });
    }
    
    // Check if preset exists and belongs to tenant
    const existingPreset = await pool.query(
      'SELECT * FROM template_presets WHERE id = $1 AND tenant_id = $2',
      [presetId, tenantId]
    );
    
    if (existingPreset.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template preset not found'
      });
    }
    
    // Validate template content if provided
    if (template_content) {
      const validation = validateTemplate(template_content);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid template content',
          validation_errors: validation.errors
        });
      }
    }
    
    // Validate event_types if provided
    if (event_types && (!Array.isArray(event_types) || event_types.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'event_types must be a non-empty array'
      });
    }
    
    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let valueIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${valueIndex++}`);
      values.push(name);
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${valueIndex++}`);
      values.push(description);
    }
    
    if (event_types !== undefined) {
      updateFields.push(`event_types = $${valueIndex++}`);
      values.push(event_types);
    }
    
    if (template_content !== undefined) {
      updateFields.push(`template_content = $${valueIndex++}`);
      values.push(template_content);
    }
    
    if (template_format !== undefined) {
      updateFields.push(`template_format = $${valueIndex++}`);
      values.push(template_format);
    }
    
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${valueIndex++}`);
      values.push(is_active);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(presetId, tenantId);
    
    const query = `
      UPDATE template_presets 
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex++} AND tenant_id = $${valueIndex++}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      preset: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating template preset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template preset'
    });
  }
});

/**
 * GET /api/v1/templates/:templateId/preview
 * Get template preview with sample data
 */
router.get('/:templateId/preview', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { mode = 'compact' } = req.query;
    
    // Get default template for the event type
    const { getDefaultTemplate, processTemplate } = require('../services/templateEngine');
    
    const template = getDefaultTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    // Create sample data based on template type
    let sampleData = {
      event: templateId,
      user: {
        name: 'John Doe',
        email: 'john@company.com'
      },
      company: {
        name: 'Sample Company'
      },
      company_domain: 'sample-company',
      company_id: 123
    };
    
    if (templateId.includes('deal')) {
      sampleData.object = {
        id: 12345,
        title: 'Sample Enterprise Deal',
        value: 50000,
        currency: 'USD',
        stage_name: 'Negotiation',
        status: 'open',
        probability: 75,
        expected_close_date: '2025-02-15',
        owner_name: 'John Doe',
        add_time: '2024-12-01T10:00:00Z',
        stage_change_time: '2024-12-10T14:30:00Z'
      };
    } else if (templateId.includes('person')) {
      sampleData.object = {
        id: 67890,
        name: 'Jane Smith',
        first_name: 'Jane',
        last_name: 'Smith',
        email: [{ value: 'jane@example.com' }],
        phone: [{ value: '+1-555-0123' }],
        org_name: 'Acme Corporation',
        job_title: 'Marketing Director',
        owner_name: 'John Doe'
      };
    } else if (templateId.includes('activity')) {
      sampleData.object = {
        id: 11111,
        subject: 'Follow-up Call',
        type: 'call',
        due_date: '2025-01-20',
        due_time: '14:30',
        duration: 30,
        note: 'Discuss pricing and next steps',
        owner_name: 'John Doe'
      };
    }
    
    // Process the template with sample data
    const preview = processTemplate(template, sampleData, {
      format: mode === 'detailed' ? 'markdown' : 'text',
      fallbackValues: {
        'company.name': 'Sample Company',
        'user.name': 'John Doe',
        'event.timestamp': new Date().toLocaleString()
      }
    });
    
    res.json({
      success: true,
      preview,
      sampleData,
      template_content: template,
      mode
    });
    
  } catch (error) {
    console.error('Error generating template preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template preview'
    });
  }
});

/**
 * DELETE /api/v1/templates/presets/:tenantId/:presetId
 * Delete a template preset
 */
router.delete('/presets/:tenantId/:presetId', requireFeature('custom_templates'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const presetId = parseInt(req.params.presetId);
    
    if (isNaN(tenantId) || isNaN(presetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID or preset ID'
      });
    }
    
    // Check if preset exists and belongs to tenant
    const existingPreset = await pool.query(
      'SELECT * FROM template_presets WHERE id = $1 AND tenant_id = $2',
      [presetId, tenantId]
    );
    
    if (existingPreset.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template preset not found'
      });
    }
    
    // Check if preset is being used by any rules
    const usageCheck = await pool.query(
      `SELECT id, name FROM notification_rules 
       WHERE template_mode = 'custom' 
       AND custom_template LIKE '%' || $1 || '%'
       AND tenant_id = $2`,
      [existingPreset.rows[0].name, tenantId]
    );
    
    if (usageCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete template preset that is in use by notification rules',
        rules_using_preset: usageCheck.rows
      });
    }
    
    // Delete the preset
    await pool.query(
      'DELETE FROM template_presets WHERE id = $1 AND tenant_id = $2',
      [presetId, tenantId]
    );
    
    res.json({
      success: true,
      message: 'Template preset deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting template preset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template preset'
    });
  }
});

/**
 * POST /api/v1/templates/presets/:tenantId/:presetId/test
 * Test template preset with sample data
 */
router.post('/presets/:tenantId/:presetId/test', requireFeature('custom_templates'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const presetId = parseInt(req.params.presetId);
    const { sample_data } = req.body;
    
    if (isNaN(tenantId) || isNaN(presetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID or preset ID'
      });
    }
    
    // Get the preset
    const presetResult = await pool.query(
      'SELECT * FROM template_presets WHERE id = $1 AND tenant_id = $2',
      [presetId, tenantId]
    );
    
    if (presetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template preset not found'
      });
    }
    
    const preset = presetResult.rows[0];
    
    // Use provided sample data or create default sample data
    const testData = sample_data || {
      event: preset.event_types[0] || 'deal.updated',
      object: {
        id: 123,
        title: 'Test Deal',
        value: 50000,
        currency: 'USD',
        status: 'open',
        probability: 75,
        stage_name: 'Negotiation'
      },
      user: {
        name: 'John Doe',
        email: 'john@example.com'
      },
      company: {
        name: 'Test Company'
      }
    };
    
    // Process the template with test data
    const { processTemplate } = require('../services/templateEngine');
    
    const result = processTemplate(preset.template_content, testData, {
      format: preset.template_format || 'text',
      strictMode: false,
      fallbackValues: {
        'company.name': 'Pipedrive',
        'user.name': 'Test User',
        'event.timestamp': new Date().toLocaleString()
      }
    });
    
    res.json({
      success: true,
      test_result: {
        preset_name: preset.name,
        template_content: preset.template_content,
        sample_data: testData,
        rendered_output: result,
        template_format: preset.template_format
      }
    });
    
  } catch (error) {
    console.error('Error testing template preset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test template preset',
      details: error.message
    });
  }
});

module.exports = router;