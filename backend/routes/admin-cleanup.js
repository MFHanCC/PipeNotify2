// Backup of debug endpoints removed during production cleanup
// These were temporary troubleshooting tools used during development

/*
// FIX TENANT MAPPING: Set Pipedrive company ID for tenant
router.post('/fix/tenant-mapping', async (req, res) => {
  // Endpoint removed - system now handles tenant mapping automatically
  // Contact support if manual intervention is needed
  res.status(410).json({
    success: false,
    message: 'This debug endpoint has been removed in production. System is now stable.',
    alternative: 'Contact support if you need assistance with tenant configuration.'
  });
});

// EMERGENCY FIX: Simple data cleanup without complex queries
router.post('/emergency/fix-data', async (req, res) => {
  // Endpoint removed - emergency fixes are no longer needed
  res.status(410).json({
    success: false,
    message: 'Emergency endpoints removed - system is stable and healthy.',
    alternative: 'Use the Testing section for system validation.'
  });
});

// DEBUG: Direct database inspection
router.get('/debug/database-state', async (req, res) => {
  // Endpoint removed - debug inspection no longer needed
  res.status(410).json({
    success: false,
    message: 'Debug endpoints removed for production security.',
    alternative: 'Use the System Health check in the Testing section.'
  });
});
*/

module.exports = {
  // This file serves as documentation of removed debug endpoints
  // All endpoints have been cleaned up for production
};