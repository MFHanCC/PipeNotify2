/**
 * Generate test JWT token for screenshot testing
 * This creates a valid JWT token for tenant_id = 1 (Team plan)
 */
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Tenant data for testing (matches our database setup)
const testTenantData = {
  tenant_id: 1,
  user_id: 1,
  company_id: 1,
  company_name: 'Test Company',
};

// Generate JWT token
const payload = {
  tenant_id: testTenantData.tenant_id,
  user_id: testTenantData.user_id,
  company_id: testTenantData.company_id,
  company_name: testTenantData.company_name,
  iat: Math.floor(Date.now() / 1000)
};

try {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'development-secret-key', {
    expiresIn: '7d' // 7 days for testing
  });

  console.log('🔑 Test JWT Token Generated:');
  console.log('Bearer', accessToken);
  console.log('\n📋 To use this token:');
  console.log('1. Open browser developer tools');
  console.log('2. Go to Application/Storage > Local Storage');
  console.log('3. Add key: auth_token');
  console.log('4. Add value:', accessToken);
  console.log('\n🧪 Or run this in browser console:');
  console.log(`localStorage.setItem('auth_token', '${accessToken}');`);
  console.log('\n✅ Token valid for 7 days');
  
} catch (error) {
  console.error('❌ Error generating token:', error.message);
  console.log('⚠️ Make sure JWT_SECRET is set in your .env file');
}