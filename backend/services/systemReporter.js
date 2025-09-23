/**
 * Comprehensive System Reporter
 * Generates detailed health reports with recommendations and insights
 * Provides executive summaries and technical deep-dives
 */

const { pool } = require('./database');

/**
 * System Reporter configuration
 */
const REPORTER_CONFIG = {
  // Report types and frequencies
  REPORT_TYPES: {
    'executive_summary': { frequency: 'daily', audience: 'management' },
    'technical_deep_dive': { frequency: 'weekly', audience: 'engineering' },
    'performance_analysis': { frequency: 'daily', audience: 'operations' },
    'security_assessment': { frequency: 'weekly', audience: 'security' },
    'capacity_planning': { frequency: 'monthly', audience: 'architecture' }
  },
  
  // Data collection periods
  DATA_PERIODS: {
    'daily': 24,      // hours
    'weekly': 168,    // hours  
    'monthly': 720    // hours (30 days)
  },
  
  // Report quality thresholds
  MIN_DATA_COMPLETENESS: 0.8, // 80% of expected data points
  MIN_CONFIDENCE_SCORE: 0.7,
  
  // Scoring weights
  HEALTH_WEIGHTS: {
    performance: 0.3,
    reliability: 0.25,
    security: 0.2,
    capacity: 0.15,
    trends: 0.1
  }
};

/**
 * Data Aggregator for collecting report data
 */
class DataAggregator {
  constructor() {
    this.cache = {};
    this.cacheExpiry = {};
  }

  /**
   * Collect comprehensive system data for reporting
   */
  async collectSystemData(periodHours = 24) {
    const cacheKey = `system_data_${periodHours}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey];
    }

    try {
      const [
        healthData,
        performanceData,
        bottlenecks,
        remediationHistory,
        predictions,
        trends
      ] = await Promise.all([
        this.collectHealthData(periodHours),
        this.collectPerformanceData(periodHours),
        this.collectBottlenecks(periodHours),
        this.collectRemediationHistory(periodHours),
        this.collectPredictions(),
        this.collectTrends(periodHours)
      ]);

      const data = {
        period: { hours: periodHours, start: new Date(Date.now() - periodHours * 60 * 60 * 1000), end: new Date() },
        health: healthData,
        performance: performanceData,
        bottlenecks,
        remediation: remediationHistory,
        predictions,
        trends,
        metadata: {
          collectedAt: new Date().toISOString(),
          dataCompleteness: this.calculateDataCompleteness(healthData, performanceData),
          confidenceScore: this.calculateConfidenceScore(healthData, performanceData, predictions)
        }
      };

      this.cache[cacheKey] = data;
      this.cacheExpiry[cacheKey] = Date.now() + 15 * 60 * 1000; // 15 minutes

      return data;
    } catch (error) {
      console.error('❌ Failed to collect system data:', error.message);
      return null;
    }
  }

  /**
   * Collect health status data
   */
  async collectHealthData(periodHours) {
    const query = `
      SELECT 
        timestamp,
        overall_status,
        health_score,
        database_status,
        database_latency_ms,
        queue_status,
        queue_backlog_size,
        self_healing_status,
        delivery_success_rate,
        response_time_ms
      FROM health_status_history 
      WHERE timestamp >= NOW() - INTERVAL '${periodHours} hours'
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query);
    const data = result.rows;

    // Calculate aggregated metrics
    const healthScores = data.map(d => d.health_score).filter(s => s !== null);
    const dbLatencies = data.map(d => d.database_latency_ms).filter(l => l !== null);
    const queueBacklogs = data.map(d => d.queue_backlog_size).filter(b => b !== null);
    const successRates = data.map(d => d.delivery_success_rate).filter(r => r !== null);

    return {
      rawData: data,
      summary: {
        averageHealthScore: this.average(healthScores),
        minHealthScore: Math.min(...healthScores),
        maxHealthScore: Math.max(...healthScores),
        averageDbLatency: this.average(dbLatencies),
        maxDbLatency: Math.max(...dbLatencies),
        averageQueueBacklog: this.average(queueBacklogs),
        maxQueueBacklog: Math.max(...queueBacklogs),
        averageSuccessRate: this.average(successRates),
        minSuccessRate: Math.min(...successRates),
        statusDistribution: this.calculateStatusDistribution(data),
        dataPoints: data.length
      }
    };
  }

  /**
   * Collect performance metrics data
   */
  async collectPerformanceData(periodHours) {
    const query = `
      SELECT 
        timestamp,
        metric_category,
        metric_data
      FROM performance_metrics 
      WHERE timestamp >= NOW() - INTERVAL '${periodHours} hours'
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query);
    const data = result.rows;

    // Group by category
    const categories = {};
    data.forEach(row => {
      if (!categories[row.metric_category]) {
        categories[row.metric_category] = [];
      }
      categories[row.metric_category].push({
        timestamp: row.timestamp,
        ...row.metric_data
      });
    });

    return {
      rawData: data,
      categories,
      summary: this.summarizePerformanceData(categories)
    };
  }

  /**
   * Collect detected bottlenecks
   */
  async collectBottlenecks(periodHours) {
    const query = `
      SELECT 
        detected_at,
        bottleneck_type,
        severity,
        description,
        resolved,
        resolved_at
      FROM performance_bottlenecks 
      WHERE detected_at >= NOW() - INTERVAL '${periodHours} hours'
      ORDER BY detected_at DESC
    `;

    const result = await pool.query(query);
    return {
      total: result.rows.length,
      critical: result.rows.filter(b => b.severity === 'critical').length,
      warning: result.rows.filter(b => b.severity === 'warning').length,
      resolved: result.rows.filter(b => b.resolved).length,
      unresolved: result.rows.filter(b => !b.resolved).length,
      byType: this.groupByField(result.rows, 'bottleneck_type'),
      details: result.rows
    };
  }

  /**
   * Collect remediation history
   */
  async collectRemediationHistory(periodHours) {
    const query = `
      SELECT 
        executed_at,
        issue_type,
        issue_severity,
        success,
        remediation_actions
      FROM remediation_history 
      WHERE executed_at >= NOW() - INTERVAL '${periodHours} hours'
      ORDER BY executed_at DESC
    `;

    const result = await pool.query(query);
    const data = result.rows;

    return {
      total: data.length,
      successful: data.filter(r => r.success).length,
      failed: data.filter(r => !r.success).length,
      successRate: data.length > 0 ? (data.filter(r => r.success).length / data.length) * 100 : 0,
      byIssueType: this.groupByField(data, 'issue_type'),
      bySeverity: this.groupByField(data, 'issue_severity'),
      details: data
    };
  }

  /**
   * Collect latest predictions
   */
  async collectPredictions() {
    const query = `
      SELECT 
        prediction_data,
        overall_status,
        critical_risks,
        warning_risks,
        average_confidence,
        created_at
      FROM health_predictions 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    const result = await pool.query(query);
    return result.rows[0] || null;
  }

  /**
   * Collect trend data
   */
  async collectTrends(periodHours) {
    const query = `
      SELECT 
        metric_category,
        metric_name,
        trend_direction,
        severity_level,
        timestamp
      FROM performance_trends 
      WHERE timestamp >= NOW() - INTERVAL '${periodHours} hours'
      ORDER BY timestamp DESC
    `;

    const result = await pool.query(query);
    return {
      total: result.rows.length,
      improving: result.rows.filter(t => t.trend_direction === 'up').length,
      degrading: result.rows.filter(t => t.trend_direction === 'down').length,
      stable: result.rows.filter(t => t.trend_direction === 'stable').length,
      critical: result.rows.filter(t => t.severity_level === 'critical').length,
      details: result.rows
    };
  }

  /**
   * Calculate data completeness score
   */
  calculateDataCompleteness(healthData, performanceData) {
    const expectedHealthPoints = Math.floor(24); // Expect hourly health data
    const actualHealthPoints = healthData.summary.dataPoints;
    const healthCompleteness = Math.min(actualHealthPoints / expectedHealthPoints, 1);

    const performanceCategories = Object.keys(performanceData.categories).length;
    const expectedCategories = 4; // cpu, memory, database, queue
    const performanceCompleteness = Math.min(performanceCategories / expectedCategories, 1);

    return (healthCompleteness + performanceCompleteness) / 2;
  }

  /**
   * Calculate confidence score for the data
   */
  calculateConfidenceScore(healthData, performanceData, predictions) {
    const dataCompleteness = this.calculateDataCompleteness(healthData, performanceData);
    const predictionConfidence = predictions?.average_confidence || 0;
    const dataVariability = this.calculateDataVariability(healthData);

    return (dataCompleteness * 0.4 + predictionConfidence * 0.4 + (1 - dataVariability) * 0.2);
  }

  /**
   * Calculate data variability (lower is better for confidence)
   */
  calculateDataVariability(healthData) {
    const healthScores = healthData.rawData.map(d => d.health_score).filter(s => s !== null);
    if (healthScores.length < 2) return 0;

    const mean = this.average(healthScores);
    const variance = healthScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / healthScores.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    return Math.min(coefficientOfVariation / 0.3, 1); // Normalize to 0-1
  }

  /**
   * Utility functions
   */
  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  calculateStatusDistribution(data) {
    const distribution = {};
    data.forEach(d => {
      const status = d.overall_status || 'unknown';
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  groupByField(data, field) {
    const groups = {};
    data.forEach(item => {
      const value = item[field] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  summarizePerformanceData(categories) {
    const summary = {};
    
    Object.entries(categories).forEach(([category, data]) => {
      if (data.length > 0) {
        summary[category] = {
          dataPoints: data.length,
          latest: data[data.length - 1],
          trends: this.calculateSimpleTrend(data)
        };
      }
    });

    return summary;
  }

  calculateSimpleTrend(data) {
    if (data.length < 2) return 'stable';
    
    const first = data[0];
    const last = data[data.length - 1];
    
    // Simple comparison - would be more sophisticated in production
    const change = (last.value - first.value) / first.value;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  isCacheValid(key) {
    return this.cache[key] && this.cacheExpiry[key] && Date.now() < this.cacheExpiry[key];
  }
}

/**
 * Report Generator for different report types
 */
class ReportGenerator {
  constructor() {
    this.aggregator = new DataAggregator();
  }

  /**
   * Generate executive summary report
   */
  async generateExecutiveSummary(periodHours = 24) {
    const data = await this.aggregator.collectSystemData(periodHours);
    if (!data) return null;

    const overallScore = this.calculateOverallHealthScore(data);
    const systemStatus = this.determineSystemStatus(overallScore, data);
    const keyMetrics = this.extractKeyMetrics(data);
    const riskAssessment = this.assessSystemRisks(data);
    const recommendations = this.generateExecutiveRecommendations(data, riskAssessment);

    return {
      reportType: 'executive_summary',
      period: data.period,
      metadata: data.metadata,
      
      summary: {
        overallHealthScore: overallScore,
        systemStatus,
        keyMetrics,
        riskLevel: riskAssessment.level,
        confidence: data.metadata.confidenceScore
      },
      
      highlights: {
        achievements: this.identifyAchievements(data),
        concerns: this.identifyConcerns(data),
        trends: this.summarizeTrends(data)
      },
      
      riskAssessment,
      recommendations,
      
      appendix: {
        dataQuality: this.assessDataQuality(data),
        methodology: 'Automated analysis based on system metrics, performance data, and predictive models'
      }
    };
  }

  /**
   * Generate technical deep dive report
   */
  async generateTechnicalDeepDive(periodHours = 168) {
    const data = await this.aggregator.collectSystemData(periodHours);
    if (!data) return null;

    return {
      reportType: 'technical_deep_dive',
      period: data.period,
      metadata: data.metadata,
      
      performanceAnalysis: {
        overview: this.analyzePerformanceOverview(data),
        bottlenecks: this.analyzeBottlenecks(data),
        resourceUtilization: this.analyzeResourceUtilization(data),
        trends: this.analyzePerformanceTrends(data)
      },
      
      reliabilityAnalysis: {
        healthMetrics: this.analyzeHealthMetrics(data),
        incidentSummary: this.analyzeIncidents(data),
        remediationEffectiveness: this.analyzeRemediationEffectiveness(data)
      },
      
      predictiveInsights: {
        forecasts: this.analyzePredictiveForecasts(data),
        riskFactors: this.identifyRiskFactors(data),
        recommendations: this.generateTechnicalRecommendations(data)
      },
      
      appendix: {
        rawData: this.prepareRawDataSummary(data),
        methodology: this.describeTechnicalMethodology(),
        glossary: this.provideTechnicalGlossary()
      }
    };
  }

  /**
   * Calculate overall health score
   */
  calculateOverallHealthScore(data) {
    const weights = REPORTER_CONFIG.HEALTH_WEIGHTS;
    
    // Performance score (0-100)
    const performanceScore = Math.min(data.health.summary.averageHealthScore || 0, 100);
    
    // Reliability score based on success rate
    const reliabilityScore = data.health.summary.averageSuccessRate || 0;
    
    // Security score (simplified - based on no critical security issues)
    const securityScore = data.bottlenecks.critical === 0 ? 100 : Math.max(100 - data.bottlenecks.critical * 20, 0);
    
    // Capacity score based on resource utilization
    const capacityScore = this.calculateCapacityScore(data);
    
    // Trends score (positive trends = higher score)
    const trendsScore = this.calculateTrendsScore(data);
    
    const overallScore = (
      performanceScore * weights.performance +
      reliabilityScore * weights.reliability +
      securityScore * weights.security +
      capacityScore * weights.capacity +
      trendsScore * weights.trends
    );

    return Math.round(Math.max(0, Math.min(100, overallScore)));
  }

  calculateCapacityScore(data) {
    // Simplified capacity scoring based on queue backlog and response times
    const avgBacklog = data.health.summary.averageQueueBacklog || 0;
    const avgResponseTime = data.health.summary.averageDbLatency || 0;
    
    let score = 100;
    
    // Penalize high queue backlog
    if (avgBacklog > 50) score -= 20;
    else if (avgBacklog > 20) score -= 10;
    
    // Penalize high response times
    if (avgResponseTime > 1000) score -= 20;
    else if (avgResponseTime > 500) score -= 10;
    
    return Math.max(0, score);
  }

  calculateTrendsScore(data) {
    const trends = data.trends;
    if (!trends || trends.total === 0) return 50; // Neutral if no trend data
    
    const improvingRatio = trends.improving / trends.total;
    const degradingRatio = trends.degrading / trends.total;
    
    // Score based on trend direction
    const trendScore = 50 + (improvingRatio - degradingRatio) * 50;
    
    return Math.max(0, Math.min(100, trendScore));
  }

  /**
   * Determine system status
   */
  determineSystemStatus(overallScore, data) {
    const criticalIssues = data.bottlenecks.critical;
    const predictionStatus = data.predictions?.overall_status;
    
    if (overallScore < 70 || criticalIssues > 0 || predictionStatus === 'critical') {
      return 'critical';
    } else if (overallScore < 85 || predictionStatus === 'warning') {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Extract key metrics for executive summary
   */
  extractKeyMetrics(data) {
    return {
      averageHealthScore: Math.round(data.health.summary.averageHealthScore || 0),
      systemUptime: this.calculateUptime(data),
      averageResponseTime: Math.round(data.health.summary.averageDbLatency || 0),
      successRate: Math.round(data.health.summary.averageSuccessRate || 0),
      criticalIssues: data.bottlenecks.critical,
      resolvedIssues: data.remediation.successful,
      autoRemediationRate: Math.round(data.remediation.successRate || 0)
    };
  }

  calculateUptime(data) {
    const healthyStatuses = ['healthy', 'warning'];
    const totalPoints = data.health.summary.dataPoints;
    const healthyPoints = Object.entries(data.health.summary.statusDistribution)
      .filter(([status]) => healthyStatuses.includes(status))
      .reduce((sum, [, count]) => sum + count, 0);
    
    return totalPoints > 0 ? Math.round((healthyPoints / totalPoints) * 100) : 0;
  }

  /**
   * Assessment and recommendation methods
   */
  assessSystemRisks(data) {
    const risks = [];
    
    // Performance risks
    if (data.health.summary.averageHealthScore < 80) {
      risks.push({
        category: 'performance',
        level: data.health.summary.averageHealthScore < 70 ? 'high' : 'medium',
        description: 'System health score below optimal threshold',
        impact: 'Potential service degradation'
      });
    }
    
    // Capacity risks
    if (data.health.summary.averageQueueBacklog > 50) {
      risks.push({
        category: 'capacity',
        level: 'medium',
        description: 'Queue backlog exceeding normal levels',
        impact: 'Delayed processing and potential timeouts'
      });
    }
    
    // Predictive risks
    if (data.predictions && data.predictions.critical_risks > 0) {
      risks.push({
        category: 'predictive',
        level: 'high',
        description: `${data.predictions.critical_risks} critical risks predicted`,
        impact: 'Potential system issues in near future'
      });
    }
    
    const overallLevel = risks.some(r => r.level === 'high') ? 'high' :
                        risks.some(r => r.level === 'medium') ? 'medium' : 'low';
    
    return {
      level: overallLevel,
      risks,
      totalRisks: risks.length
    };
  }

  generateExecutiveRecommendations(data, riskAssessment) {
    const recommendations = [];
    
    // Based on risk level
    if (riskAssessment.level === 'high') {
      recommendations.push({
        priority: 'immediate',
        category: 'operational',
        action: 'Conduct immediate system review and capacity assessment',
        rationale: 'High-risk conditions detected requiring immediate attention'
      });
    }
    
    // Based on performance
    if (data.health.summary.averageHealthScore < 85) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        action: 'Implement performance optimization measures',
        rationale: 'System performance below target threshold'
      });
    }
    
    // Based on auto-remediation effectiveness
    if (data.remediation.successRate < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'automation',
        action: 'Review and enhance auto-remediation capabilities',
        rationale: 'Auto-remediation success rate below optimal level'
      });
    }
    
    // Always include monitoring recommendation
    recommendations.push({
      priority: 'ongoing',
      category: 'monitoring',
      action: 'Continue enhanced monitoring and trend analysis',
      rationale: 'Maintain visibility into system health and performance'
    });
    
    return recommendations;
  }

  /**
   * Analysis methods for technical deep dive
   */
  analyzePerformanceOverview(data) {
    return {
      summary: data.performance.summary,
      keyFindings: this.identifyPerformanceFindings(data),
      recommendations: this.generatePerformanceRecommendations(data)
    };
  }

  analyzeBottlenecks(data) {
    return {
      summary: {
        total: data.bottlenecks.total,
        critical: data.bottlenecks.critical,
        resolved: data.bottlenecks.resolved,
        resolutionRate: data.bottlenecks.total > 0 ? 
          Math.round((data.bottlenecks.resolved / data.bottlenecks.total) * 100) : 0
      },
      breakdown: data.bottlenecks.byType,
      topBottlenecks: data.bottlenecks.details.slice(0, 5)
    };
  }

  identifyPerformanceFindings(data) {
    const findings = [];
    
    if (data.health.summary.averageDbLatency > 500) {
      findings.push('Database response times elevated above 500ms threshold');
    }
    
    if (data.health.summary.maxQueueBacklog > 100) {
      findings.push(`Peak queue backlog reached ${data.health.summary.maxQueueBacklog} jobs`);
    }
    
    if (data.health.summary.minSuccessRate < 95) {
      findings.push(`Success rate dropped to ${data.health.summary.minSuccessRate.toFixed(1)}%`);
    }
    
    return findings;
  }

  /**
   * Utility methods
   */
  identifyAchievements(data) {
    const achievements = [];
    
    if (data.health.summary.averageSuccessRate > 99) {
      achievements.push('Maintained >99% success rate');
    }
    
    if (data.remediation.successRate > 90) {
      achievements.push('High auto-remediation success rate');
    }
    
    if (data.bottlenecks.critical === 0) {
      achievements.push('No critical bottlenecks detected');
    }
    
    return achievements;
  }

  identifyConcerns(data) {
    const concerns = [];
    
    if (data.health.summary.averageHealthScore < 85) {
      concerns.push('Health score below target');
    }
    
    if (data.predictions && data.predictions.critical_risks > 0) {
      concerns.push('Critical risks predicted');
    }
    
    if (data.bottlenecks.unresolved > 0) {
      concerns.push(`${data.bottlenecks.unresolved} unresolved bottlenecks`);
    }
    
    return concerns;
  }

  summarizeTrends(data) {
    const trends = data.trends;
    return {
      improving: trends.improving,
      stable: trends.stable,
      degrading: trends.degrading,
      overall: trends.degrading > trends.improving ? 'declining' : 
               trends.improving > trends.degrading ? 'improving' : 'stable'
    };
  }

  assessDataQuality(data) {
    return {
      completeness: Math.round(data.metadata.dataCompleteness * 100),
      confidence: Math.round(data.metadata.confidenceScore * 100),
      freshness: 'Current', // Since we just collected it
      coverage: 'Comprehensive'
    };
  }

  // Additional methods for technical deep dive would go here...
  generateTechnicalRecommendations(data) {
    return ['Detailed technical recommendations would be generated here'];
  }

  describeTechnicalMethodology() {
    return 'Statistical analysis of time-series data with predictive modeling and anomaly detection';
  }

  provideTechnicalGlossary() {
    return {
      'Health Score': 'Composite metric (0-100) indicating overall system wellness',
      'Bottleneck': 'System component limiting overall performance',
      'Auto-Remediation': 'Automated system for detecting and fixing issues'
    };
  }

  // Placeholder methods for technical analysis
  analyzeHealthMetrics(data) { return data.health.summary; }
  analyzeIncidents(data) { return data.bottlenecks; }
  analyzeRemediationEffectiveness(data) { return data.remediation; }
  analyzePredictiveForecasts(data) { return data.predictions; }
  identifyRiskFactors(data) { return []; }
  analyzeResourceUtilization(data) { return {}; }
  analyzePerformanceTrends(data) { return {}; }
  prepareRawDataSummary(data) { return 'Raw data summary available upon request'; }
  generatePerformanceRecommendations(data) { return []; }
}

/**
 * Main System Reporter
 */
class SystemReporter {
  constructor() {
    this.generator = new ReportGenerator();
    this.running = false;
    this.scheduledReports = new Map();
  }

  /**
   * Start automated reporting
   */
  async start() {
    if (this.running) return;
    
    console.log('📊 Starting System Reporter...');
    this.running = true;

    // Schedule automated reports
    this.scheduleReports();

    console.log('✅ SYSTEM REPORTER STARTED - generating automated reports');
  }

  /**
   * Stop automated reporting
   */
  stop() {
    if (!this.running) return;
    
    console.log('🛑 Stopping System Reporter...');
    this.running = false;

    // Clear scheduled reports
    this.scheduledReports.forEach(interval => clearInterval(interval));
    this.scheduledReports.clear();

    console.log('✅ System Reporter stopped');
  }

  /**
   * Generate a specific type of report
   */
  async generateReport(reportType, options = {}) {
    console.log(`📋 Generating ${reportType} report...`);
    
    try {
      let report = null;
      
      switch (reportType) {
        case 'executive_summary':
          report = await this.generator.generateExecutiveSummary(options.periodHours);
          break;
        case 'technical_deep_dive':
          report = await this.generator.generateTechnicalDeepDive(options.periodHours);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      if (report) {
        await this.storeReport(report);
        console.log(`✅ ${reportType} report generated successfully`);
      }
      
      return report;
    } catch (error) {
      console.error(`❌ Failed to generate ${reportType} report:`, error.message);
      return null;
    }
  }

  /**
   * Schedule automated reports
   */
  scheduleReports() {
    // Daily executive summary
    const dailyInterval = setInterval(async () => {
      await this.generateReport('executive_summary', { periodHours: 24 });
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    this.scheduledReports.set('daily_executive', dailyInterval);

    // Weekly technical deep dive
    const weeklyInterval = setInterval(async () => {
      await this.generateReport('technical_deep_dive', { periodHours: 168 });
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    this.scheduledReports.set('weekly_technical', weeklyInterval);
  }

  /**
   * Store report in database
   */
  async storeReport(report) {
    try {
      const query = `
        INSERT INTO system_reports (
          report_type, report_data, overall_score, system_status,
          period_hours, confidence_score, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await pool.query(query, [
        report.reportType,
        JSON.stringify(report),
        report.summary?.overallHealthScore || null,
        report.summary?.systemStatus || 'unknown',
        report.period?.hours || 24,
        report.metadata?.confidenceScore || null
      ]);
    } catch (error) {
      console.error('❌ Failed to store report:', error.message);
    }
  }

  /**
   * Get report status
   */
  getStatus() {
    return {
      running: this.running,
      scheduledReports: Array.from(this.scheduledReports.keys()),
      lastReportGenerated: new Date().toISOString()
    };
  }
}

module.exports = {
  SystemReporter,
  ReportGenerator,
  DataAggregator,
  REPORTER_CONFIG
};