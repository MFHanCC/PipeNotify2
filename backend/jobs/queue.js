const { Queue } = require('bullmq');

// Redis connection configuration
let redisConfig;

console.log('🔍 Redis Environment Check:');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
console.log('REDIS_HOST:', process.env.REDIS_HOST || 'Not set');
console.log('REDIS_PORT:', process.env.REDIS_PORT || 'Not set');

/**
 * Check whether a Redis server is reachable based on environment configuration.
 *
 * Attempts to connect and ping Redis using either REDIS_URL or REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.
 * Resolves to true when a successful ping occurs within the timeout window; otherwise resolves to false.
 * Logs a short status message but does not throw on failure.
 *
 * @returns {Promise<boolean>} True if Redis responded to a ping within the timeout; false if no config is present or the connection failed/timed out.
 */
async function testRedisConnection() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.log('⚠️ No Redis configuration found - disabling Redis features');
    return false;
  }
  
  try {
    const Redis = require('ioredis');
    let testRedis;
    
    if (process.env.REDIS_URL) {
      testRedis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        commandTimeout: 3000,
        lazyConnect: false,
        maxRetriesPerRequest: 0,
        retryDelayOnFailover: 100
      });
    } else {
      testRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 3000,
        commandTimeout: 3000,
        lazyConnect: false,
        maxRetriesPerRequest: 0,
        retryDelayOnFailover: 100
      });
    }
    
    // Test with timeout
    const testPromise = Promise.race([
      testRedis.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    
    await testPromise;
    await testRedis.disconnect();
    console.log('✅ Redis connection test successful');
    return true;
  } catch (error) {
    console.log('❌ Redis connection test failed:', error.message);
    console.log('⚠️ This is expected in development without Redis - falling back to synchronous processing');
    return false;
  }
}

/**
 * Determine and return a BullMQ-compatible Redis connection configuration based on runtime connectivity and environment.
 *
 * Tests actual Redis reachability via testRedisConnection(). If Redis is not reachable or no Redis env vars are set, returns null (the system should run in synchronous/degraded mode).
 *
 * Behavior:
 * - If REDIS_URL is set and reachable, parses the URL and returns an object { connection: { host, port, password, ... } } with options tuned for BullMQ (timeouts, lazyConnect, retry behavior, keepAlive, and a reconnectOnError handler that retries on `READONLY` errors).
 * - If REDIS_HOST is set and reachable, returns a similar { connection: { host, port, password, ... } } using explicit host/port/password values.
 *
 * @returns {{connection: object}|null} BullMQ connection configuration when Redis is available; otherwise null.
 */
async function initializeRedisConfig() {
  const redisAvailable = await testRedisConnection();
  
  if (!redisAvailable) {
    console.log('🔧 Redis not available - using synchronous processing');
    return null;
  }

  if (process.env.REDIS_URL) {
    // Parse Railway Redis URL: redis://username:password@host:port
    const url = new URL(process.env.REDIS_URL);
    console.log('📊 Parsed Redis URL - Host:', url.hostname, 'Port:', url.port);
    
    return {
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
  } else if (process.env.REDIS_HOST) {
    // Local development with explicit Redis host
    console.log('🔧 Using explicit Redis configuration');
    return {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        enableOfflineQueue: false,
        keepAlive: 30000
      }
    };
  }
  
  return null;
}

// Initialize configuration asynchronously
redisConfig = null;
let initPromise = initializeRedisConfig().then(config => {
  redisConfig = config;
  return config;
});

// Create notification queue with error handling
let notificationQueue;

/**
 * Initialize the BullMQ notification queue after Redis configuration is ready.
 *
 * Waits for global initPromise, inspects the resolved redisConfig, and if present
 * constructs and assigns the global `notificationQueue` with event listeners for
 * lifecycle events (waiting, active, completed, failed, error). If Redis is not
 * available or queue creation fails, sets `notificationQueue` to null to signal
 * synchronous/degraded mode.
 *
 * Side effects:
 * - Awaits `initPromise`.
 * - May create and assign the module-scoped `notificationQueue`.
 * - Attaches logging event handlers to the queue when created.
 *
 * @returns {Promise<void>} Resolves after initialization completes (either with
 *                          a ready queue or with `notificationQueue` set to null).
 */
async function createQueue() {
  await initPromise; // Wait for Redis initialization
  
  console.log('⚙️ Final Redis Config:', JSON.stringify(redisConfig, null, 2));

  if (redisConfig) {
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

      console.log('✅ Notification queue initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification queue:', error.message);
      console.log('⚠️ Running in degraded mode without queue functionality');
      notificationQueue = null;
    }
  } else {
    console.log('⚠️ Redis not available - running in synchronous mode');
    notificationQueue = null;
  }
}

// Initialize queue on startup
createQueue().catch(error => {
  console.error('Failed to initialize queue:', error);
});

/**
 * Enqueue a notification processing job or, if the queue is unavailable, process synchronously.
 *
 * If a BullMQ queue is configured and reachable this adds a `processNotification` job
 * with configurable delay, attempts, and exponential backoff. If the queue is not
 * available or adding the job fails, the function falls back to synchronous processing
 * by calling the local `processor.processNotification`.
 *
 * @param {Object} webhookData - Payload passed to the job or to the synchronous processor.
 * @param {Object} [options] - Optional job settings.
 * @param {number} [options.delay=0] - Milliseconds to delay the job before it becomes available.
 * @param {number} [options.attempts=3] - Number of retry attempts for the job.
 * @return {Promise<import('bullmq').Job|any>} Resolves to the BullMQ Job when queued; otherwise resolves to the synchronous processor's result.
 */
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
  initPromise // Export so other modules can wait for Redis initialization
};