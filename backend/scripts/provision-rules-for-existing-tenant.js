/**
 * Script to provision default rules for existing tenant
 * This helps test the provisioning system and solve the "no notifications" issue
 */

const { provisionDefaultRules, getProvisioningStatus } = require('../services/ruleProvisioning');

async function provisionRulesForTenant() {
  try {
    // Tenant ID 2 based on the Railway logs showing company_id 13887824 maps to tenant 2
    const tenantId = 2;
    
    console.log('🔧 Starting rule provisioning for existing tenant...');
    console.log(`📋 Tenant ID: ${tenantId}`);
    
    // Get current status
    console.log('\n📊 Getting current provisioning status...');
    const currentStatus = await getProvisioningStatus(tenantId);
    console.log('Current status:', JSON.stringify(currentStatus, null, 2));
    
    // Provision default rules for free tier (since tenant is likely on free)
    console.log('\n🚀 Provisioning default rules for free tier...');
    const result = await provisionDefaultRules(tenantId, 'free', 'manual');
    
    if (result.success) {
      console.log('\n✅ SUCCESS! Rule provisioning completed');
      console.log(`📝 Rules created: ${result.rules_created}`);
      console.log(`⏭️  Rules skipped: ${result.rules_skipped || 0}`);
      console.log(`🎯 Webhook used: ${result.webhook_used?.name} (ID: ${result.webhook_used?.id})`);
      
      if (result.created_rules && result.created_rules.length > 0) {
        console.log('\n📋 Created rules:');
        result.created_rules.forEach(rule => {
          console.log(`  • ${rule.name} (${rule.event_type}) - ID: ${rule.id}`);
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  Some errors occurred:');
        result.errors.forEach(error => {
          console.log(`  • ${error.template_name}: ${error.error}`);
        });
      }
      
      console.log('\n🎉 User should now receive notifications when creating/updating deals in Pipedrive!');
      
    } else {
      console.log('\n❌ FAILED! Rule provisioning failed');
      console.log('Error:', result.error);
      
      if (result.requires_webhook_setup) {
        console.log('\n💡 ACTION REQUIRED: User needs to set up a Google Chat webhook first');
        console.log('   1. Go to Dashboard → Webhooks');
        console.log('   2. Add a Google Chat webhook URL');
        console.log('   3. Run this script again');
      }
    }
    
  } catch (error) {
    console.error('\n💥 Script execution failed:', error);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('\n🏁 Script completed');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  console.log('🎬 Starting default rules provisioning script...');
  provisionRulesForTenant();
}

module.exports = { provisionRulesForTenant };