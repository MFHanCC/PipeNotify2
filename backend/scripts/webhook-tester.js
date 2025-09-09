const axios = require('axios');

async function testGoogleChatWebhook() {
  const webhook = 'https://chat.googleapis.com/v1/spaces/AAQASsBob7E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=reMpAdFngUO-J6g9278dze05lysc8CVlb7orJAdK0zQ';
  
  console.log('🔍 Testing Google Chat webhook with different message formats...');
  
  // Test 1: Simple text message
  try {
    const response1 = await axios.post(webhook, {
      text: '🤖 Test 1: Simple text message from Pipenotify autonomous tester'
    });
    console.log('✅ Test 1 (simple text) passed:', response1.status);
  } catch (error) {
    console.log('❌ Test 1 failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 2: Card message format
  try {
    const response2 = await axios.post(webhook, {
      cards: [{
        header: {
          title: '🚀 Pipenotify Test',
          subtitle: 'Autonomous Testing System'
        },
        sections: [{
          widgets: [{
            textParagraph: {
              text: '✅ Testing Google Chat integration from autonomous system'
            }
          }]
        }]
      }]
    });
    console.log('✅ Test 2 (card format) passed:', response2.status);
  } catch (error) {
    console.log('❌ Test 2 failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 3: Thread message
  try {
    const response3 = await axios.post(webhook, {
      text: '🔧 Test 3: Thread message - Autonomous monitoring system is active!',
      thread: { name: 'spaces/AAQASsBob7E/threads/pipenotify-test' }
    });
    console.log('✅ Test 3 (thread) passed:', response3.status);
  } catch (error) {
    console.log('❌ Test 3 failed:', error.response?.status, error.response?.data || error.message);
  }
}

testGoogleChatWebhook();