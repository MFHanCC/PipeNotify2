const { Queue } = require('bullmq');

// Redis connection configuration
let redisConfig;

if (process.env.REDIS_URL) {
  // Parse Railway Redis URL: redis://username:password@host:port
  const url = new URL(process.env.REDIS_URL);
  redisConfig = {
    connection: {
      host: url.hostname,
      port: parseInt(url.port),
      password: url.password,
      family: 4,
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false
    }
  };
} else {
  // Local development fallback
  redisConfig = {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    }
  };
}

// Create notification queue
const notificationQueue = new Queue('notification', redisConfig);

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

// Helper function to add notification job
async function addNotificationJob(webhookData, options = {}) {
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
    throw error;
  }
}

// Helper function to get queue stats
async function getQueueStats() {
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
      total: waiting.length + active.length + completed.length + failed.length
    };
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return null;
  }
}

module.exports = {
  notificationQueue,
  addNotificationJob,
  getQueueStats,
  redisConfig
};