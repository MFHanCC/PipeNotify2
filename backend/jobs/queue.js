const { Queue } = require('bullmq');

// Redis connection configuration
let redisConfig;

console.log('🔍 Redis Environment Check:');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
console.log('REDIS_HOST:', process.env.REDIS_HOST || 'Not set');
console.log('REDIS_PORT:', process.env.REDIS_PORT || 'Not set');

if (process.env.REDIS_URL) {
  // Parse Railway Redis URL: redis://username:password@host:port
  const url = new URL(process.env.REDIS_URL);
  console.log('📊 Parsed Redis URL - Host:', url.hostname, 'Port:', url.port);
  
  redisConfig = {
    connection: {
      host: url.hostname,
      port: parseInt(url.port),
      password: url.password,
      family: 4,
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      keepAlive: 30000,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    }
  };
} else {
  // Local development fallback
  console.log('🔧 Using fallback Redis configuration');
  redisConfig = {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      keepAlive: 30000
    }
  };
}

console.log('⚙️ Final Redis Config:', JSON.stringify(redisConfig, null, 2));

// Create notification queue with error handling
let notificationQueue;

try {
  notificationQueue = new Queue('notification', redisConfig);

  // Queue event listeners for monitoring
  notificationQueue.on('waiting', (job) => {
    console.log(`Job ${job.id} is waiting`);
  });

  notificationQueue.on('active', (job) => {
    console.log(`Job ${job.id} is now active`);
  });

  notificationQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
  });

  notificationQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
  });

  notificationQueue.on('error', (err) => {
    console.error('Queue error:', err.message);
  });

  console.log('✅ Notification queue initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize notification queue:', error.message);
  console.log('⚠️ Running in degraded mode without queue functionality');
  notificationQueue = null;
}

// Helper function to add notification job
async function addNotificationJob(webhookData, options = {}) {
  if (!notificationQueue) {
    console.warn('⚠️ Queue not available - processing notification synchronously');
    // Fallback to synchronous processing
    const processor = require('./processor');
    return await processor.processNotification(webhookData);
  }

  try {
    const job = await notificationQueue.add('processNotification', webhookData, {
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 50, // Keep last 50 completed jobs
      removeOnFail: 20      // Keep last 20 failed jobs
    });

    console.log(`Notification job ${job.id} added to queue`);
    return job;
  } catch (error) {
    console.error('Failed to add notification job:', error);
    console.log('⚠️ Falling back to synchronous processing');
    // Fallback to synchronous processing
    const processor = require('./processor');
    return await processor.processNotification(webhookData);
  }
}

// Helper function to get queue stats
async function getQueueStats() {
  if (!notificationQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
      status: 'unavailable'
    };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      notificationQueue.getWaiting(),
      notificationQueue.getActive(),
      notificationQueue.getCompleted(),
      notificationQueue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
      status: 'connected'
    };
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
      status: 'error',
      error: error.message
    };
  }
}

// Get queue information for health checks
async function getQueueInfo() {
  try {
    if (!notificationQueue) {
      throw new Error('Notification queue not initialized');
    }

    const [waiting, active, completed, failed] = await Promise.all([
      notificationQueue.getWaiting(),
      notificationQueue.getActive(),
      notificationQueue.getCompleted(),
      notificationQueue.getFailed()
    ]);

    // Test Redis connection
    let redisHealthy = false;
    try {
      await notificationQueue.client.ping();
      redisHealthy = true;
    } catch (redisError) {
      console.error('Redis ping failed:', redisError);
    }

    return {
      connected: true,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      redis: redisHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  notificationQueue,
  addNotificationJob,
  getQueueStats,
  getQueueInfo,
  redisConfig
};