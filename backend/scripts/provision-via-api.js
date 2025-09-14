/**
 * Provision default rules via API endpoint
 * This bypasses database connection issues by using the running Railway API
 */

const axios = require('axios');

async function provisionViaAPI() {
  try {
    const baseURL = 'https://pipenotify.up.railway.app/api/v1/admin';
    
    console.log('🔧 Provisioning default rules via API...');
    console.log(`📡 Base URL: ${baseURL}`);
    
    // Note: This will fail without proper auth token, but it will at least trigger the endpoint
    // The user should call this endpoint from their dashboard instead
    
    const response = await axios.post(`${baseURL}/provision-default-rules`, {
      planTier: 'free',
      force: true
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        // User needs to add their JWT token here
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
      }
    });
    
    console.log('✅ SUCCESS!', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('📋 API Response:', error.response.status, error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n💡 EXPECTED: Need valid JWT token');
        console.log('   👉 User should call this endpoint from their dashboard');
        console.log('   📍 Endpoint: POST /api/v1/admin/provision-default-rules');
        console.log('   📦 Body: { "planTier": "free", "force": true }');
      }
    } else {
      console.error('❌ Request failed:', error.message);
    }
  }
}

provisionViaAPI();