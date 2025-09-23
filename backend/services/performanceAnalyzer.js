/**
 * Advanced System Performance Analyzer
 * Provides deep performance metrics, bottleneck detection, and optimization recommendations
 */

const { pool } = require('./database');
const os = require('os');

/**
 * Performance analyzer configuration
 */
const PERFORMANCE_CONFIG = {
  // Sampling intervals
  METRICS_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  ANALYSIS_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
  
  // Performance thresholds
  CPU_WARNING_THRESHOLD: 70,
  CPU_CRITICAL_THRESHOLD: 85,
  MEMORY_WARNING_THRESHOLD: 75,
  MEMORY_CRITICAL_THRESHOLD: 90,
  RESPONSE_TIME_WARNING_MS: 500,
  RESPONSE_TIME_CRITICAL_MS: 1000,
  
  // Bottleneck detection settings
  BOTTLENECK_SAMPLE_SIZE: 20,
  BOTTLENECK_THRESHOLD_RATIO: 0.8, // 80% of samples must be slow
  
  // Historical data retention
  METRICS_RETENTION_HOURS: 72, // 3 days
  ANALYSIS_RETENTION_DAYS: 30
};

/**
 * System Performance Metrics Collection
 */
class SystemMetrics {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      cpu: [],
      memory: [],
      database: [],
      api: [],
      queue: []
    };
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics() {
    const timestamp = new Date().toISOString();
    
    try {
      const [cpuMetrics, memoryMetrics, dbMetrics, queueMetrics] = await Promise.all([
        this.getCPUMetrics(),
        this.getMemoryMetrics(),
        this.getDatabaseMetrics(),
        this.getQueueMetrics()
      ]);

      const metrics = {
        timestamp,
        cpu: cpuMetrics,
        memory: memoryMetrics,
        database: dbMetrics,
        queue: queueMetrics,
        uptime: Date.now() - this.startTime
      };

      // Store metrics for analysis
      await this.storeMetrics(metrics);
      
      return metrics;
    } catch (error) {
      console.error('❌ Failed to collect system metrics:', error.message);
      return null;
    }
  }

  /**
   * Get detailed CPU metrics
   */
  async getCPUMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage over 1 second interval
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = (endUsage.user + endUsage.system) / 1000; // Convert to ms
    const cpuPercent = (totalUsage / 1000) * 100; // Percentage over 1 second
    
    return {
      usage_percent: Math.min(cpuPercent, 100),
      load_average_1m: loadAvg[0],
      load_average_5m: loadAvg[1],
      load_average_15m: loadAvg[2],
      cores: cpus.length,
      architecture: os.arch(),
      platform: os.platform()
    };
  }

  /**
   * Get detailed memory metrics
   */
  async getMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();
    
    return {
      total_bytes: totalMemory,
      used_bytes: usedMemory,
      free_bytes: freeMemory,
      usage_percent: (usedMemory / totalMemory) * 100,
      process_heap_used: memoryUsage.heapUsed,
      process_heap_total: memoryUsage.heapTotal,
      process_external: memoryUsage.external,
      process_rss: memoryUsage.rss
    };
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics() {
    try {
      const queries = [
        'SELECT NOW() as current_time',
        'SELECT COUNT(*) as total_connections FROM pg_stat_activity',
        'SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'',
        'SELECT datname, numbackends, xact_commit, xact_rollback FROM pg_stat_database WHERE datname = current_database()'
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(query => 
          pool.query(query).catch(error => ({ error: error.message }))
        )
      );
      const queryTime = Date.now() - startTime;

      // Parse results safely
      const connections = results[1]?.rows?.[0]?.total_connections || 0;
      const activeConnections = results[2]?.rows?.[0]?.active_connections || 0;
      const dbStats = results[3]?.rows?.[0] || {};

      return {
        response_time_ms: queryTime,
        total_connections: parseInt(connections),
        active_connections: parseInt(activeConnections),
        committed_transactions: parseInt(dbStats.xact_commit || 0),
        rolled_back_transactions: parseInt(dbStats.xact_rollback || 0),
        backends: parseInt(dbStats.numbackends || 0),
        healthy: queryTime < PERFORMANCE_CONFIG.RESPONSE_TIME_CRITICAL_MS
      };
    } catch (error) {
      return {
        response_time_ms: -1,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Get queue performance metrics
   */
  async getQueueMetrics() {
    try {
      // This would connect to Redis/BullMQ for queue stats
      // For now, return simulated metrics
      return {
        active_jobs: 0,
        waiting_jobs: 0,
        completed_jobs_1h: 0,
        failed_jobs_1h: 0,
        processing_rate_per_minute: 0,
        average_job_duration_ms: 0,
        healthy: true
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Store metrics in database
   */
  async storeMetrics(metrics) {
    try {
      const query = `
        INSERT INTO performance_metrics (
          timestamp, metric_category, metric_data
        ) VALUES ($1, $2, $3)
      `;

      await Promise.all([
        pool.query(query, [metrics.timestamp, 'cpu', JSON.stringify(metrics.cpu)]),
        pool.query(query, [metrics.timestamp, 'memory', JSON.stringify(metrics.memory)]),
        pool.query(query, [metrics.timestamp, 'database', JSON.stringify(metrics.database)]),
        pool.query(query, [metrics.timestamp, 'queue', JSON.stringify(metrics.queue)])
      ]);
    } catch (error) {
      console.error('❌ Failed to store performance metrics:', error.message);
    }
  }
}

/**
 * Performance Bottleneck Detector
 */
class BottleneckDetector {
  constructor() {
    this.recentMetrics = [];
    this.bottlenecks = [];
  }

  /**
   * Analyze system for performance bottlenecks
   */
  async analyzeBottlenecks(currentMetrics) {
    this.recentMetrics.push(currentMetrics);
    
    // Keep only recent samples
    if (this.recentMetrics.length > PERFORMANCE_CONFIG.BOTTLENECK_SAMPLE_SIZE) {
      this.recentMetrics.shift();
    }

    if (this.recentMetrics.length < 5) {
      return []; // Need more data
    }

    const bottlenecks = [];

    // Detect CPU bottlenecks
    const cpuBottleneck = this.detectCPUBottleneck();
    if (cpuBottleneck) bottlenecks.push(cpuBottleneck);

    // Detect memory bottlenecks
    const memoryBottleneck = this.detectMemoryBottleneck();
    if (memoryBottleneck) bottlenecks.push(memoryBottleneck);

    // Detect database bottlenecks
    const dbBottleneck = this.detectDatabaseBottleneck();
    if (dbBottleneck) bottlenecks.push(dbBottleneck);

    // Detect queue bottlenecks
    const queueBottleneck = this.detectQueueBottleneck();
    if (queueBottleneck) bottlenecks.push(queueBottleneck);

    this.bottlenecks = bottlenecks;
    return bottlenecks;
  }

  /**
   * Detect CPU performance bottlenecks
   */
  detectCPUBottleneck() {
    const cpuUsages = this.recentMetrics.map(m => m.cpu?.usage_percent || 0);
    const highUsageCount = cpuUsages.filter(usage => usage > PERFORMANCE_CONFIG.CPU_WARNING_THRESHOLD).length;
    const ratio = highUsageCount / cpuUsages.length;

    if (ratio >= PERFORMANCE_CONFIG.BOTTLENECK_THRESHOLD_RATIO) {
      const avgUsage = cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length;
      const severity = avgUsage > PERFORMANCE_CONFIG.CPU_CRITICAL_THRESHOLD ? 'critical' : 'warning';
      
      return {
        type: 'cpu',
        severity,
        description: `High CPU usage detected (${avgUsage.toFixed(1)}% average)`,
        impact: 'System response times may be degraded',
        recommendations: [
          'Consider scaling up CPU resources',
          'Optimize CPU-intensive operations',
          'Review and optimize algorithms',
          'Enable CPU profiling to identify hot spots'
        ],
        metrics: {
          average_usage: avgUsage,
          peak_usage: Math.max(...cpuUsages),
          affected_samples: highUsageCount,
          sample_size: cpuUsages.length
        }
      };
    }
    return null;
  }

  /**
   * Detect memory performance bottlenecks
   */
  detectMemoryBottleneck() {
    const memoryUsages = this.recentMetrics.map(m => m.memory?.usage_percent || 0);
    const highUsageCount = memoryUsages.filter(usage => usage > PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD).length;
    const ratio = highUsageCount / memoryUsages.length;

    if (ratio >= PERFORMANCE_CONFIG.BOTTLENECK_THRESHOLD_RATIO) {
      const avgUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
      const severity = avgUsage > PERFORMANCE_CONFIG.MEMORY_CRITICAL_THRESHOLD ? 'critical' : 'warning';
      
      return {
        type: 'memory',
        severity,
        description: `High memory usage detected (${avgUsage.toFixed(1)}% average)`,
        impact: 'Risk of out-of-memory errors and performance degradation',
        recommendations: [
          'Increase available memory',
          'Optimize memory usage in application code',
          'Implement memory caching strategies',
          'Review for memory leaks',
          'Tune garbage collection settings'
        ],
        metrics: {
          average_usage: avgUsage,
          peak_usage: Math.max(...memoryUsages),
          affected_samples: highUsageCount,
          sample_size: memoryUsages.length
        }
      };
    }
    return null;
  }

  /**
   * Detect database performance bottlenecks
   */
  detectDatabaseBottleneck() {
    const dbTimes = this.recentMetrics
      .map(m => m.database?.response_time_ms)
      .filter(time => time !== undefined && time > 0);
    
    if (dbTimes.length === 0) return null;

    const slowQueryCount = dbTimes.filter(time => time > PERFORMANCE_CONFIG.RESPONSE_TIME_WARNING_MS).length;
    const ratio = slowQueryCount / dbTimes.length;

    if (ratio >= PERFORMANCE_CONFIG.BOTTLENECK_THRESHOLD_RATIO) {
      const avgTime = dbTimes.reduce((sum, time) => sum + time, 0) / dbTimes.length;
      const severity = avgTime > PERFORMANCE_CONFIG.RESPONSE_TIME_CRITICAL_MS ? 'critical' : 'warning';
      
      return {
        type: 'database',
        severity,
        description: `Slow database queries detected (${avgTime.toFixed(0)}ms average)`,
        impact: 'Application response times will be affected',
        recommendations: [
          'Optimize slow queries',
          'Add database indexes',
          'Consider connection pooling optimization',
          'Review database configuration',
          'Monitor for blocking queries'
        ],
        metrics: {
          average_response_time: avgTime,
          peak_response_time: Math.max(...dbTimes),
          slow_query_count: slowQueryCount,
          sample_size: dbTimes.length
        }
      };
    }
    return null;
  }

  /**
   * Detect queue performance bottlenecks
   */
  detectQueueBottleneck() {
    const queueMetrics = this.recentMetrics.map(m => m.queue).filter(q => q && q.healthy !== false);
    
    if (queueMetrics.length === 0) return null;

    const waitingJobs = queueMetrics.map(q => q.waiting_jobs || 0);
    const avgWaiting = waitingJobs.reduce((sum, count) => sum + count, 0) / waitingJobs.length;
    const processingRates = queueMetrics.map(q => q.processing_rate_per_minute || 0);
    const avgProcessingRate = processingRates.reduce((sum, rate) => sum + rate, 0) / processingRates.length;

    // Detect if queue is backing up (more waiting than being processed)
    if (avgWaiting > avgProcessingRate * 2 && avgWaiting > 10) {
      return {
        type: 'queue',
        severity: avgWaiting > avgProcessingRate * 5 ? 'critical' : 'warning',
        description: `Queue backlog detected (${avgWaiting.toFixed(0)} jobs waiting on average)`,
        impact: 'Delayed processing of background tasks and notifications',
        recommendations: [
          'Increase queue worker capacity',
          'Optimize job processing logic',
          'Implement job prioritization',
          'Review job failure rates',
          'Consider horizontal scaling'
        ],
        metrics: {
          average_waiting_jobs: avgWaiting,
          average_processing_rate: avgProcessingRate,
          peak_waiting_jobs: Math.max(...waitingJobs),
          sample_size: queueMetrics.length
        }
      };
    }
    return null;
  }
}

/**
 * Performance Optimizer
 */
class PerformanceOptimizer {
  constructor() {
    this.optimizations = [];
  }

  /**
   * Generate performance optimization recommendations
   */
  async generateOptimizations(metrics, bottlenecks) {
    const optimizations = [];

    // General system optimizations
    optimizations.push(...this.getSystemOptimizations(metrics));

    // Bottleneck-specific optimizations
    for (const bottleneck of bottlenecks) {
      optimizations.push(...this.getBottleneckOptimizations(bottleneck));
    }

    // Proactive optimizations
    optimizations.push(...this.getProactiveOptimizations(metrics));

    return this.prioritizeOptimizations(optimizations);
  }

  /**
   * Get system-wide optimization recommendations
   */
  getSystemOptimizations(metrics) {
    const optimizations = [];

    // CPU optimizations
    if (metrics.cpu?.usage_percent > 60) {
      optimizations.push({
        category: 'cpu',
        priority: 'medium',
        title: 'CPU Usage Optimization',
        description: 'CPU usage is elevated, consider optimization opportunities',
        actions: [
          'Profile CPU-intensive functions',
          'Implement request-level caching',
          'Optimize database queries',
          'Consider async processing for heavy operations'
        ],
        estimated_impact: 'medium'
      });
    }

    // Memory optimizations
    if (metrics.memory?.usage_percent > 60) {
      optimizations.push({
        category: 'memory',
        priority: 'medium',
        title: 'Memory Usage Optimization',
        description: 'Memory usage is elevated, optimization recommended',
        actions: [
          'Implement object pooling',
          'Optimize data structures',
          'Review caching strategies',
          'Monitor for memory leaks'
        ],
        estimated_impact: 'medium'
      });
    }

    return optimizations;
  }

  /**
   * Get bottleneck-specific optimizations
   */
  getBottleneckOptimizations(bottleneck) {
    const optimizations = [];

    optimizations.push({
      category: bottleneck.type,
      priority: bottleneck.severity === 'critical' ? 'high' : 'medium',
      title: `${bottleneck.type.toUpperCase()} Bottleneck Resolution`,
      description: bottleneck.description,
      actions: bottleneck.recommendations,
      estimated_impact: bottleneck.severity === 'critical' ? 'high' : 'medium',
      metrics: bottleneck.metrics
    });

    return optimizations;
  }

  /**
   * Get proactive optimization recommendations
   */
  getProactiveOptimizations(metrics) {
    const optimizations = [];

    // Always recommend monitoring improvements
    optimizations.push({
      category: 'monitoring',
      priority: 'low',
      title: 'Enhanced Monitoring',
      description: 'Improve system observability and performance tracking',
      actions: [
        'Enable detailed performance profiling',
        'Set up automated performance alerts',
        'Implement distributed tracing',
        'Add custom performance metrics'
      ],
      estimated_impact: 'low'
    });

    return optimizations;
  }

  /**
   * Prioritize optimizations by impact and urgency
   */
  prioritizeOptimizations(optimizations) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return optimizations.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      return bPriority - aPriority;
    });
  }
}

/**
 * Main Performance Analyzer
 */
class PerformanceAnalyzer {
  constructor() {
    this.metrics = new SystemMetrics();
    this.detector = new BottleneckDetector();
    this.optimizer = new PerformanceOptimizer();
    this.running = false;
  }

  /**
   * Start continuous performance analysis
   */
  async start() {
    if (this.running) return;
    
    console.log('📊 Starting Advanced Performance Analyzer...');
    this.running = true;

    // Initial analysis
    await this.runAnalysis();

    // Schedule regular analysis
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, PERFORMANCE_CONFIG.METRICS_INTERVAL_MS);

    this.analysisInterval = setInterval(async () => {
      await this.runAnalysis();
    }, PERFORMANCE_CONFIG.ANALYSIS_INTERVAL_MS);

    console.log('✅ PERFORMANCE ANALYZER STARTED - collecting metrics every 5 minutes');
  }

  /**
   * Stop performance analysis
   */
  stop() {
    if (!this.running) return;
    
    console.log('🛑 Stopping Performance Analyzer...');
    this.running = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    console.log('✅ Performance Analyzer stopped');
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics() {
    try {
      const metrics = await this.metrics.collectMetrics();
      if (metrics) {
        console.log(`📈 Performance metrics collected: CPU ${metrics.cpu.usage_percent.toFixed(1)}%, Memory ${metrics.memory.usage_percent.toFixed(1)}%, DB ${metrics.database.response_time_ms}ms`);
      }
      return metrics;
    } catch (error) {
      console.error('❌ Failed to collect performance metrics:', error.message);
      return null;
    }
  }

  /**
   * Run complete performance analysis
   */
  async runAnalysis() {
    try {
      console.log('🔍 Running performance analysis...');
      
      const currentMetrics = await this.collectMetrics();
      if (!currentMetrics) return;

      const bottlenecks = await this.detector.analyzeBottlenecks(currentMetrics);
      const optimizations = await this.optimizer.generateOptimizations(currentMetrics, bottlenecks);

      if (bottlenecks.length > 0) {
        console.log(`⚠️ Performance analysis found ${bottlenecks.length} bottleneck(s):`);
        bottlenecks.forEach(bottleneck => {
          console.log(`   • ${bottleneck.type.toUpperCase()} (${bottleneck.severity}): ${bottleneck.description}`);
        });
      }

      if (optimizations.length > 0) {
        console.log(`💡 Generated ${optimizations.length} optimization recommendation(s)`);
      }

      return {
        timestamp: new Date().toISOString(),
        metrics: currentMetrics,
        bottlenecks,
        optimizations
      };
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Get current performance status
   */
  async getPerformanceStatus() {
    const currentMetrics = await this.collectMetrics();
    if (!currentMetrics) {
      return { healthy: false, error: 'Unable to collect metrics' };
    }

    const bottlenecks = await this.detector.analyzeBottlenecks(currentMetrics);
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    const warningBottlenecks = bottlenecks.filter(b => b.severity === 'warning');

    return {
      healthy: criticalBottlenecks.length === 0,
      status: criticalBottlenecks.length > 0 ? 'critical' : 
              warningBottlenecks.length > 0 ? 'warning' : 'healthy',
      metrics: currentMetrics,
      bottlenecks,
      summary: {
        cpu_usage: currentMetrics.cpu.usage_percent,
        memory_usage: currentMetrics.memory.usage_percent,
        db_response_time: currentMetrics.database.response_time_ms,
        critical_issues: criticalBottlenecks.length,
        warnings: warningBottlenecks.length
      }
    };
  }
}

// Export the analyzer
module.exports = {
  PerformanceAnalyzer,
  SystemMetrics,
  BottleneckDetector,
  PerformanceOptimizer,
  PERFORMANCE_CONFIG
};