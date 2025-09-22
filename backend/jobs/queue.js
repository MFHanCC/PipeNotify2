const { Queue } = require('bullmq');

// Redis connection configuration
let redisConfig;

// Redis connection configuration

if (process.env.REDIS_URL) {
  // Parse Redis URL: redis:// or rediss:// (TLS)
  const url = new URL(process.env.REDIS_URL);
  console.log('🔧 Configuring Redis for Railway deployment');
  console.log('🔗 Redis host:', url.hostname);
  
  redisConfig = {
    connection: {
      host: url.hostname,
      port: parseInt(url.port),
      password: url.password,
      family: 0, // Allow both IPv4 and IPv6 (Railway compatibility)
      connectTimeout: 15000, // Increased timeout for Railway
      lazyConnect: true,
      maxRetriesPerRequest: 3, // Enable retries
      retryDelayOnFailover: 500,
      enableOfflineQueue: false,
      keepAlive: 30000,
      // Enhanced Railway networking support
      retryDelayOnClusterDown: 300,
      enableReadyCheck: true,
      maxLoadingTimeout: 10000,
      reconnectOnError: (err) => {
        console.log('🔄 Redis reconnection check:', err.message);
        const targetErrors = ['READONLY', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
        return targetErrors.some(error => err.message.includes(error));
      }
    }
  };

  // Add TLS configuration for rediss:// URLs
  if (url.protocol === 'rediss:') {
    connectionConfig.tls = {
      rejectUnauthorized: false // Allow self-signed certificates for Redis providers
    };
  }

  // Add username if present in URL
  if (url.username) {
    connectionConfig.username = url.username;
  }

  redisConfig = {
    connection: connectionConfig
  };
} else {
  // Local development fallback
  console.log('🔧 Using fallback Redis configuration');
  redisConfig = {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      family: 4, // IPv4 for local development
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      keepAlive: 30000
    }
  };
}


// Create notification queue with enhanced Railway error handling
let notificationQueue;

console.log('🔄 Initializing Redis notification queue...');

async function initializeQueue() {
  try {
    notificationQueue = new Queue('notification', redisConfig);

    // Enhanced event listeners for Railway debugging
    notificationQueue.on('waiting', (job) => {
      console.log(`📋 Job ${job.id} is waiting`);
    });

    notificationQueue.on('active', (job) => {
      console.log(`⚡ Job ${job.id} is now active`);
    });

    notificationQueue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    notificationQueue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    notificationQueue.on('error', (err) => {
      console.error('❌ Queue error:', err.message);
      
      if (err.message.includes('ENOTFOUND')) {
        console.error('🚨 Redis DNS resolution failed - Railway networking issue');
        console.error('💡 Consider using Redis public URL as workaround');
      } else if (err.message.includes('ECONNREFUSED')) {
        console.error('🚨 Redis connection refused - service may be down');
      } else if (err.message.includes('authentication')) {
        console.error('🚨 Redis authentication failed - check REDIS_URL password');
      }
    });

    // Test the connection
    await notificationQueue.waitUntilReady();
    console.log('✅ Notification queue initialized successfully');
    console.log('🔗 Redis connection established');
    
  } catch (error) {
    console.error('❌ Failed to initialize notification queue:', error.message);
    console.log('⚠️ Running in degraded mode without queue functionality');
    notificationQueue = null;
  }
}

// Initialize queue asynchronously and export the promise
const initPromise = initializeQueue();

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

    // Test Redis connection - fix for BullMQ v5
    let redisHealthy = false;
    try {
      // BullMQ uses ioredis which exposes Redis client differently
      const redis = await notificationQueue.client;
      if (redis && typeof redis.ping === 'function') {
        await redis.ping();
        redisHealthy = true;
      } else {
        // Alternative: test with a simple operation
        await notificationQueue.getWaiting(0, 0);
        redisHealthy = true;
      }
    } catch (redisError) {
      console.error('Redis health check failed:', redisError.message);
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
  redisConfig,
  initPromise
};