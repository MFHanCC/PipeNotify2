/**
 * Advanced Debugging Tools
 * Enhanced diagnostic capabilities for complex system issues
 * Provides deep system introspection and debugging assistance
 */

const { pool } = require('./database');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

/**
 * Advanced debugger configuration
 */
const DEBUGGER_CONFIG = {
  // Debugging levels
  DEBUG_LEVELS: {
    'trace': 0,
    'debug': 1,
    'info': 2,
    'warn': 3,
    'error': 4,
    'fatal': 5
  },
  
  // Data collection settings
  MAX_STACK_TRACE_DEPTH: 50,
  MAX_LOG_ENTRIES: 1000,
  MAX_MEMORY_SAMPLES: 100,
  
  // Performance profiling
  PROFILING_SAMPLE_INTERVAL_MS: 100,
  MAX_PROFILING_DURATION_MS: 30 * 1000, // 30 seconds
  
  // Debug session settings
  MAX_CONCURRENT_SESSIONS: 5,
  SESSION_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes
  
  // Output formatting
  CONSOLE_COLORS: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
  }
};

/**
 * System Introspector for deep system analysis
 */
class SystemIntrospector {
  constructor() {
    this.snapshots = [];
    this.watchers = new Map();
  }

  /**
   * Take a comprehensive system snapshot
   */
  async takeSystemSnapshot() {
    const timestamp = new Date().toISOString();
    
    try {
      const snapshot = {
        timestamp,
        process: await this.getProcessInfo(),
        memory: await this.getMemoryInfo(),
        performance: await this.getPerformanceInfo(),
        database: await this.getDatabaseInfo(),
        environment: await this.getEnvironmentInfo(),
        network: await this.getNetworkInfo(),
        filesystem: await this.getFilesystemInfo()
      };

      this.snapshots.push(snapshot);
      
      // Keep only recent snapshots
      if (this.snapshots.length > 10) {
        this.snapshots = this.snapshots.slice(-10);
      }

      return snapshot;
    } catch (error) {
      console.error('❌ Failed to take system snapshot:', error.message);
      return null;
    }
  }

  /**
   * Get detailed process information
   */
  async getProcessInfo() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: process.versions,
      uptime: process.uptime(),
      cwd: process.cwd(),
      execPath: process.execPath,
      execArgv: process.execArgv,
      argv: process.argv,
      env: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        // Add other relevant env vars (be careful not to expose secrets)
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * Get detailed memory information
   */
  async getMemoryInfo() {
    const memUsage = process.memoryUsage();
    
    // Get V8 heap statistics if available
    let v8Stats = {};
    try {
      const v8 = require('v8');
      v8Stats = v8.getHeapStatistics();
    } catch (error) {
      // V8 stats not available
    }

    // Calculate memory pressure indicators
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const memoryPressure = this.calculateMemoryPressure(memUsage, v8Stats);

    return {
      usage: memUsage,
      v8Statistics: v8Stats,
      analysis: {
        heapUsedPercent,
        memoryPressure,
        fragmentation: this.calculateFragmentation(memUsage),
        recommendations: this.generateMemoryRecommendations(memUsage, heapUsedPercent)
      }
    };
  }

  /**
   * Get performance timing information
   */
  async getPerformanceInfo() {
    const performanceData = {
      hrtime: process.hrtime(),
      timing: {}
    };

    // Get performance timing if available
    try {
      if (typeof performance !== 'undefined') {
        performanceData.timing = {
          now: performance.now(),
          timeOrigin: performance.timeOrigin
        };
      }
    } catch (error) {
      // Performance API not available
    }

    // Get event loop delay if available
    try {
      const { monitorEventLoopDelay } = require('perf_hooks');
      const histogram = monitorEventLoopDelay({ resolution: 20 });
      histogram.enable();
      
      // Sample for a short period
      await new Promise(resolve => setTimeout(resolve, 100));
      histogram.disable();
      
      performanceData.eventLoop = {
        min: histogram.min,
        max: histogram.max,
        mean: histogram.mean,
        stddev: histogram.stddev,
        percentiles: {
          p50: histogram.percentile(50),
          p90: histogram.percentile(90),
          p95: histogram.percentile(95),
          p99: histogram.percentile(99)
        }
      };
    } catch (error) {
      // Event loop monitoring not available
    }

    return performanceData;
  }

  /**
   * Get database connection and performance info
   */
  async getDatabaseInfo() {
    try {
      const startTime = process.hrtime.bigint();
      
      // Test query
      const result = await pool.query('SELECT NOW() as current_time, version() as version');
      
      const endTime = process.hrtime.bigint();
      const queryTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Get connection pool stats
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };

      return {
        connected: true,
        queryResponseTime: queryTime,
        serverInfo: result.rows[0],
        connectionPool: poolStats,
        analysis: {
          connectionHealthy: queryTime < 100, // Under 100ms is good
          poolUtilization: (pool.totalCount - pool.idleCount) / pool.totalCount,
          recommendations: this.generateDatabaseRecommendations(queryTime, poolStats)
        }
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        analysis: {
          connectionHealthy: false,
          recommendations: ['Check database connection configuration', 'Verify database server status']
        }
      };
    }
  }

  /**
   * Get environment and configuration info
   */
  async getEnvironmentInfo() {
    const os = require('os');
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      cpus: os.cpus().map(cpu => ({
        model: cpu.model,
        speed: cpu.speed
      })),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces())
    };
  }

  /**
   * Get network connectivity info
   */
  async getNetworkInfo() {
    const networkInfo = {
      interfaces: {},
      connectivity: {}
    };

    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      
      Object.entries(interfaces).forEach(([name, addresses]) => {
        networkInfo.interfaces[name] = addresses.map(addr => ({
          address: addr.address,
          netmask: addr.netmask,
          family: addr.family,
          internal: addr.internal
        }));
      });

      // Test basic connectivity (simplified)
      networkInfo.connectivity.hasExternalAccess = true; // Would implement actual check
      
    } catch (error) {
      networkInfo.error = error.message;
    }

    return networkInfo;
  }

  /**
   * Get filesystem information
   */
  async getFilesystemInfo() {
    const filesystemInfo = {
      workingDirectory: process.cwd(),
      tempDirectory: require('os').tmpdir(),
      diskSpace: {}
    };

    try {
      // Get basic file system stats
      const stats = await fs.stat(process.cwd());
      filesystemInfo.workingDirectoryStats = {
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };

      // Check if we can write to temp directory
      try {
        const testFile = path.join(require('os').tmpdir(), 'debugger-test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        filesystemInfo.tempDirectoryWritable = true;
      } catch (error) {
        filesystemInfo.tempDirectoryWritable = false;
      }

    } catch (error) {
      filesystemInfo.error = error.message;
    }

    return filesystemInfo;
  }

  /**
   * Calculate memory pressure indicator
   */
  calculateMemoryPressure(memUsage, v8Stats) {
    const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
    const externalRatio = memUsage.external / memUsage.rss;
    
    let pressure = 'low';
    if (heapUsedRatio > 0.9 || externalRatio > 0.5) {
      pressure = 'high';
    } else if (heapUsedRatio > 0.7 || externalRatio > 0.3) {
      pressure = 'medium';
    }
    
    return pressure;
  }

  /**
   * Calculate memory fragmentation
   */
  calculateFragmentation(memUsage) {
    const totalAllocated = memUsage.heapUsed + memUsage.external;
    const fragmentation = (memUsage.rss - totalAllocated) / memUsage.rss;
    return Math.max(0, fragmentation);
  }

  /**
   * Generate memory recommendations
   */
  generateMemoryRecommendations(memUsage, heapUsedPercent) {
    const recommendations = [];
    
    if (heapUsedPercent > 90) {
      recommendations.push('Critical: Heap usage over 90%, consider memory optimization');
    } else if (heapUsedPercent > 70) {
      recommendations.push('Warning: Heap usage over 70%, monitor for memory leaks');
    }
    
    if (memUsage.external > memUsage.heapUsed) {
      recommendations.push('High external memory usage, review Buffer and TypedArray usage');
    }
    
    return recommendations;
  }

  /**
   * Generate database recommendations
   */
  generateDatabaseRecommendations(queryTime, poolStats) {
    const recommendations = [];
    
    if (queryTime > 1000) {
      recommendations.push('Critical: Database response time over 1000ms');
    } else if (queryTime > 500) {
      recommendations.push('Warning: Database response time over 500ms');
    }
    
    const poolUtilization = (poolStats.totalCount - poolStats.idleCount) / poolStats.totalCount;
    if (poolUtilization > 0.9) {
      recommendations.push('High connection pool utilization, consider increasing pool size');
    }
    
    if (poolStats.waitingCount > 0) {
      recommendations.push('Queries waiting for connections, review pool configuration');
    }
    
    return recommendations;
  }
}

/**
 * Error Tracker for comprehensive error analysis
 */
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.errorCounts = new Map();
    this.originalConsoleError = console.error;
    this.originalUncaughtException = process.listeners('uncaughtException');
    this.originalUnhandledRejection = process.listeners('unhandledRejection');
  }

  /**
   * Start error tracking
   */
  start() {
    this.hijackConsoleError();
    this.setupUncaughtExceptionHandler();
    this.setupUnhandledRejectionHandler();
    console.log('🔍 Advanced error tracking started');
  }

  /**
   * Stop error tracking
   */
  stop() {
    this.restoreConsoleError();
    this.removeErrorHandlers();
    console.log('🔍 Advanced error tracking stopped');
  }

  /**
   * Hijack console.error to track all errors
   */
  hijackConsoleError() {
    const self = this;
    console.error = function(...args) {
      self.trackError(new Error(args.join(' ')), 'console');
      self.originalConsoleError.apply(console, args);
    };
  }

  /**
   * Restore original console.error
   */
  restoreConsoleError() {
    console.error = this.originalConsoleError;
  }

  /**
   * Setup uncaught exception handler
   */
  setupUncaughtExceptionHandler() {
    const self = this;
    process.on('uncaughtException', (error) => {
      self.trackError(error, 'uncaughtException');
    });
  }

  /**
   * Setup unhandled rejection handler
   */
  setupUnhandledRejectionHandler() {
    const self = this;
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      self.trackError(error, 'unhandledRejection');
    });
  }

  /**
   * Remove error handlers
   */
  removeErrorHandlers() {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    // Restore original listeners
    this.originalUncaughtException.forEach(listener => {
      process.on('uncaughtException', listener);
    });
    this.originalUnhandledRejection.forEach(listener => {
      process.on('unhandledRejection', listener);
    });
  }

  /**
   * Track an error with detailed context
   */
  trackError(error, source = 'unknown') {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      source,
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context: this.captureErrorContext(),
      hash: this.generateErrorHash(error)
    };

    this.errors.push(errorInfo);
    
    // Update error counts
    const count = this.errorCounts.get(errorInfo.hash) || 0;
    this.errorCounts.set(errorInfo.hash, count + 1);

    // Keep only recent errors
    if (this.errors.length > DEBUGGER_CONFIG.MAX_LOG_ENTRIES) {
      this.errors = this.errors.slice(-DEBUGGER_CONFIG.MAX_LOG_ENTRIES);
    }

    return errorInfo;
  }

  /**
   * Capture context around error occurrence
   */
  captureErrorContext() {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid
      },
      timestamp: Date.now()
    };
  }

  /**
   * Generate hash for error deduplication
   */
  generateErrorHash(error) {
    const crypto = require('crypto');
    const hashInput = `${error.name}:${error.message}:${this.getCleanStack(error.stack)}`;
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Clean stack trace for hashing
   */
  getCleanStack(stack) {
    if (!stack) return '';
    
    return stack
      .split('\n')
      .slice(0, 5) // Only first 5 lines
      .map(line => line.replace(/:\d+:\d+/g, '')) // Remove line numbers
      .join('\n');
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis() {
    const recentErrors = this.errors.slice(-50); // Last 50 errors
    const errorsByType = new Map();
    const errorsBySource = new Map();
    
    recentErrors.forEach(error => {
      // Count by type
      const typeCount = errorsByType.get(error.name) || 0;
      errorsByType.set(error.name, typeCount + 1);
      
      // Count by source
      const sourceCount = errorsBySource.get(error.source) || 0;
      errorsBySource.set(error.source, sourceCount + 1);
    });

    return {
      totalErrors: this.errors.length,
      recentErrors: recentErrors.length,
      uniqueErrors: this.errorCounts.size,
      mostCommonErrors: Array.from(this.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      errorsByType: Object.fromEntries(errorsByType),
      errorsBySource: Object.fromEntries(errorsBySource),
      lastError: this.errors[this.errors.length - 1]
    };
  }
}

/**
 * Performance Profiler for detailed performance analysis
 */
class PerformanceProfiler {
  constructor() {
    this.sessions = new Map();
    this.profiles = [];
  }

  /**
   * Start a profiling session
   */
  startProfiling(sessionId = 'default', options = {}) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Profiling session '${sessionId}' already active`);
    }

    const session = {
      id: sessionId,
      startTime: Date.now(),
      samples: [],
      options: {
        sampleInterval: options.sampleInterval || DEBUGGER_CONFIG.PROFILING_SAMPLE_INTERVAL_MS,
        maxDuration: options.maxDuration || DEBUGGER_CONFIG.MAX_PROFILING_DURATION_MS,
        trackMemory: options.trackMemory !== false,
        trackCPU: options.trackCPU !== false
      }
    };

    this.sessions.set(sessionId, session);

    // Start sampling
    session.interval = setInterval(() => {
      this.takeSample(session);
    }, session.options.sampleInterval);

    // Auto-stop after max duration
    session.timeout = setTimeout(() => {
      this.stopProfiling(sessionId);
    }, session.options.maxDuration);

    console.log(`🔬 Profiling session '${sessionId}' started`);
    return session;
  }

  /**
   * Stop a profiling session
   */
  stopProfiling(sessionId = 'default') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Profiling session '${sessionId}' not found`);
    }

    // Clear interval and timeout
    if (session.interval) clearInterval(session.interval);
    if (session.timeout) clearTimeout(session.timeout);

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    // Generate profile analysis
    const profile = this.analyzeProfile(session);
    this.profiles.push(profile);

    // Cleanup session
    this.sessions.delete(sessionId);

    console.log(`🔬 Profiling session '${sessionId}' completed (${session.duration}ms)`);
    return profile;
  }

  /**
   * Take a performance sample
   */
  takeSample(session) {
    const sample = {
      timestamp: Date.now(),
      relativeTime: Date.now() - session.startTime
    };

    if (session.options.trackMemory) {
      sample.memory = process.memoryUsage();
    }

    if (session.options.trackCPU) {
      sample.cpu = process.cpuUsage();
    }

    // Add to samples
    session.samples.push(sample);

    // Limit sample count
    if (session.samples.length > DEBUGGER_CONFIG.MAX_MEMORY_SAMPLES) {
      session.samples.shift();
    }
  }

  /**
   * Analyze profiling data
   */
  analyzeProfile(session) {
    const samples = session.samples;
    if (samples.length === 0) {
      return { error: 'No samples collected' };
    }

    const analysis = {
      sessionId: session.id,
      duration: session.duration,
      sampleCount: samples.length,
      sampleInterval: session.options.sampleInterval
    };

    // Memory analysis
    if (session.options.trackMemory) {
      const memoryData = samples.map(s => s.memory).filter(m => m);
      if (memoryData.length > 0) {
        analysis.memory = {
          heapUsed: this.analyzeMetric(memoryData.map(m => m.heapUsed)),
          heapTotal: this.analyzeMetric(memoryData.map(m => m.heapTotal)),
          external: this.analyzeMetric(memoryData.map(m => m.external)),
          rss: this.analyzeMetric(memoryData.map(m => m.rss))
        };
      }
    }

    // CPU analysis
    if (session.options.trackCPU) {
      const cpuData = samples.map(s => s.cpu).filter(c => c);
      if (cpuData.length > 1) {
        // Calculate CPU usage deltas
        const cpuDeltas = [];
        for (let i = 1; i < cpuData.length; i++) {
          const delta = {
            user: cpuData[i].user - cpuData[i-1].user,
            system: cpuData[i].system - cpuData[i-1].system
          };
          cpuDeltas.push(delta);
        }
        
        analysis.cpu = {
          user: this.analyzeMetric(cpuDeltas.map(d => d.user)),
          system: this.analyzeMetric(cpuDeltas.map(d => d.system))
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze a metric array
   */
  analyzeMetric(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      trend: this.calculateTrend(values)
    };
  }

  /**
   * Calculate trend direction
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 5) return 'increasing';
    if (changePercent < -5) return 'decreasing';
    return 'stable';
  }
}

/**
 * Debug Session Manager
 */
class DebugSession {
  constructor(sessionId, options = {}) {
    this.id = sessionId;
    this.startTime = Date.now();
    this.options = options;
    this.data = {
      logs: [],
      snapshots: [],
      errors: [],
      profiles: []
    };
    this.active = true;
  }

  /**
   * Add log entry to session
   */
  log(level, message, context = {}) {
    if (!this.active) return;

    this.data.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    });

    // Keep logs within limit
    if (this.data.logs.length > DEBUGGER_CONFIG.MAX_LOG_ENTRIES) {
      this.data.logs.shift();
    }
  }

  /**
   * Add snapshot to session
   */
  addSnapshot(snapshot) {
    if (!this.active) return;
    
    this.data.snapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.data.snapshots.length > 10) {
      this.data.snapshots.shift();
    }
  }

  /**
   * Get session summary
   */
  getSummary() {
    return {
      id: this.id,
      duration: Date.now() - this.startTime,
      active: this.active,
      stats: {
        logs: this.data.logs.length,
        snapshots: this.data.snapshots.length,
        errors: this.data.errors.length,
        profiles: this.data.profiles.length
      }
    };
  }

  /**
   * Close session
   */
  close() {
    this.active = false;
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
  }
}

/**
 * Main Advanced Debugger
 */
class AdvancedDebugger {
  constructor() {
    this.introspector = new SystemIntrospector();
    this.errorTracker = new ErrorTracker();
    this.profiler = new PerformanceProfiler();
    this.sessions = new Map();
    this.running = false;
  }

  /**
   * Start advanced debugging
   */
  async start() {
    if (this.running) return;
    
    console.log('🔧 Starting Advanced Debugging Tools...');
    this.running = true;

    // Start error tracking
    this.errorTracker.start();

    // Take initial system snapshot
    await this.introspector.takeSystemSnapshot();

    console.log('✅ ADVANCED DEBUGGER STARTED - comprehensive debugging active');
  }

  /**
   * Stop advanced debugging
   */
  stop() {
    if (!this.running) return;
    
    console.log('🛑 Stopping Advanced Debugger...');
    this.running = false;

    // Stop error tracking
    this.errorTracker.stop();

    // Close all sessions
    this.sessions.forEach(session => session.close());
    this.sessions.clear();

    console.log('✅ Advanced Debugger stopped');
  }

  /**
   * Create a debug session
   */
  createSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Debug session '${sessionId}' already exists`);
    }

    if (this.sessions.size >= DEBUGGER_CONFIG.MAX_CONCURRENT_SESSIONS) {
      throw new Error('Maximum concurrent debug sessions reached');
    }

    const session = new DebugSession(sessionId, options);
    this.sessions.set(sessionId, session);

    // Auto-close session after timeout
    setTimeout(() => {
      if (this.sessions.has(sessionId)) {
        this.closeSession(sessionId);
      }
    }, DEBUGGER_CONFIG.SESSION_TIMEOUT_MS);

    console.log(`🔍 Debug session '${sessionId}' created`);
    return session;
  }

  /**
   * Close a debug session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session '${sessionId}' not found`);
    }

    session.close();
    this.sessions.delete(sessionId);
    
    console.log(`🔍 Debug session '${sessionId}' closed`);
    return session;
  }

  /**
   * Get comprehensive debug report
   */
  async getDebugReport() {
    const snapshot = await this.introspector.takeSystemSnapshot();
    const errorAnalysis = this.errorTracker.getErrorAnalysis();
    
    return {
      timestamp: new Date().toISOString(),
      systemSnapshot: snapshot,
      errorAnalysis,
      activeSessions: Array.from(this.sessions.values()).map(s => s.getSummary()),
      profiles: this.profiler.profiles.slice(-5), // Last 5 profiles
      recommendations: this.generateDebugRecommendations(snapshot, errorAnalysis)
    };
  }

  /**
   * Generate debugging recommendations
   */
  generateDebugRecommendations(snapshot, errorAnalysis) {
    const recommendations = [];

    // Memory recommendations
    if (snapshot && snapshot.memory) {
      const memAnalysis = snapshot.memory.analysis;
      if (memAnalysis.memoryPressure === 'high') {
        recommendations.push({
          category: 'memory',
          priority: 'high',
          issue: 'High memory pressure detected',
          recommendations: memAnalysis.recommendations
        });
      }
    }

    // Error recommendations
    if (errorAnalysis.recentErrors > 10) {
      recommendations.push({
        category: 'errors',
        priority: 'medium',
        issue: `${errorAnalysis.recentErrors} recent errors detected`,
        recommendations: [
          'Review error patterns for common causes',
          'Implement better error handling',
          'Check for resource leaks'
        ]
      });
    }

    // Database recommendations
    if (snapshot && snapshot.database) {
      const dbAnalysis = snapshot.database.analysis;
      if (!dbAnalysis.connectionHealthy) {
        recommendations.push({
          category: 'database',
          priority: 'critical',
          issue: 'Database connection issues detected',
          recommendations: dbAnalysis.recommendations
        });
      }
    }

    return recommendations;
  }

  /**
   * Get debugger status
   */
  getStatus() {
    return {
      running: this.running,
      activeSessions: this.sessions.size,
      totalSnapshots: this.introspector.snapshots.length,
      totalErrors: this.errorTracker.errors.length,
      totalProfiles: this.profiler.profiles.length
    };
  }
}

module.exports = {
  AdvancedDebugger,
  SystemIntrospector,
  ErrorTracker,
  PerformanceProfiler,
  DebugSession,
  DEBUGGER_CONFIG
};