/**
 * Predictive Health Forecasting System
 * ML-based predictions of system issues and health trends
 * Provides early warning system for potential problems
 */

const { pool } = require('./database');

/**
 * Health prediction configuration
 */
const PREDICTION_CONFIG = {
  // Prediction windows
  SHORT_TERM_HOURS: 6,
  MEDIUM_TERM_HOURS: 24,
  LONG_TERM_HOURS: 72,
  
  // Historical data requirements
  MIN_DATA_POINTS: 20,
  OPTIMAL_DATA_POINTS: 100,
  
  // Prediction accuracy thresholds
  MIN_CONFIDENCE_THRESHOLD: 0.7,
  HIGH_CONFIDENCE_THRESHOLD: 0.85,
  
  // Trend analysis settings
  TREND_WINDOW_HOURS: 24,
  SEASONALITY_DETECTION_DAYS: 7,
  
  // Alert thresholds for predictions
  CRITICAL_PREDICTION_THRESHOLD: 0.8, // 80% chance of critical issue
  WARNING_PREDICTION_THRESHOLD: 0.6,  // 60% chance of issue
  
  // Model refresh intervals
  MODEL_REFRESH_HOURS: 12,
  BASELINE_RECALCULATION_DAYS: 7
};

/**
 * Time Series Data Processor
 */
class TimeSeriesProcessor {
  constructor() {
    this.data = [];
    this.trends = {};
    this.seasonality = {};
  }

  /**
   * Load historical health data for analysis
   */
  async loadHistoricalData(metricType, hoursBack = 168) { // 7 days default
    try {
      const query = `
        SELECT 
          timestamp,
          health_score,
          database_latency_ms,
          queue_backlog_size,
          delivery_success_rate,
          response_time_ms
        FROM health_status_history 
        WHERE timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        ORDER BY timestamp ASC
      `;
      
      const result = await pool.query(query);
      this.data = result.rows.map(row => ({
        timestamp: new Date(row.timestamp),
        healthScore: row.health_score || 100,
        dbLatency: row.database_latency_ms || 0,
        queueBacklog: row.queue_backlog_size || 0,
        successRate: row.delivery_success_rate || 100,
        responseTime: row.response_time_ms || 0
      }));

      console.log(`📊 Loaded ${this.data.length} historical data points for prediction`);
      return this.data;
    } catch (error) {
      console.error('❌ Failed to load historical data:', error.message);
      return [];
    }
  }

  /**
   * Detect trends in the data using linear regression
   */
  detectTrends(metricName) {
    if (this.data.length < PREDICTION_CONFIG.MIN_DATA_POINTS) {
      return { trend: 'insufficient_data', slope: 0, confidence: 0 };
    }

    const values = this.data.map(d => d[metricName]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return { trend: 'no_data', slope: 0, confidence: 0 };

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
    const sumXX = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const totalSumSquares = y.map(yi => Math.pow(yi - yMean, 2)).reduce((a, b) => a + b, 0);
    const residualSumSquares = y.map((yi, i) => Math.pow(yi - (slope * i + intercept), 2)).reduce((a, b) => a + b, 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    // Determine trend direction
    let trend = 'stable';
    if (Math.abs(slope) > 0.1) { // Threshold for significant trend
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      slope,
      intercept,
      confidence: Math.max(0, rSquared),
      dataPoints: n
    };
  }

  /**
   * Detect seasonal patterns in the data
   */
  detectSeasonality(metricName) {
    if (this.data.length < PREDICTION_CONFIG.MIN_DATA_POINTS) {
      return { hasSeasonality: false, pattern: null };
    }

    const values = this.data.map(d => d[metricName]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return { hasSeasonality: false, pattern: null };

    // Simple hourly pattern detection
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    this.data.forEach(point => {
      const hour = point.timestamp.getHours();
      const value = point[metricName];
      if (value !== undefined && value !== null) {
        hourlyAverages[hour] += value;
        hourlyCounts[hour]++;
      }
    });

    // Calculate averages
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }

    // Check for significant variation (simple heuristic)
    const overallAverage = hourlyAverages.reduce((a, b) => a + b, 0) / 24;
    const variance = hourlyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAverage, 2), 0) / 24;
    const hasSeasonality = variance > overallAverage * 0.1; // 10% variation threshold

    return {
      hasSeasonality,
      pattern: hasSeasonality ? hourlyAverages : null,
      variance,
      overallAverage
    };
  }

  /**
   * Detect anomalies in the data using statistical methods
   */
  detectAnomalies(metricName, windowSize = 10) {
    if (this.data.length < windowSize) return [];

    const values = this.data.map(d => d[metricName]).filter(v => v !== undefined && v !== null);
    const anomalies = [];

    for (let i = windowSize; i < values.length; i++) {
      const window = values.slice(i - windowSize, i);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const stdDev = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length);
      
      const currentValue = values[i];
      const zScore = stdDev > 0 ? Math.abs(currentValue - mean) / stdDev : 0;
      
      if (zScore > 2.5) { // 2.5 standard deviations
        anomalies.push({
          index: i,
          timestamp: this.data[i].timestamp,
          value: currentValue,
          expected: mean,
          deviation: zScore,
          severity: zScore > 3.5 ? 'high' : 'medium'
        });
      }
    }

    return anomalies;
  }
}

/**
 * Predictive Models
 */
class PredictiveModels {
  constructor() {
    this.models = {};
    this.lastTraining = {};
  }

  /**
   * Simple linear extrapolation model
   */
  linearExtrapolation(data, metric, hoursAhead) {
    if (data.length < PREDICTION_CONFIG.MIN_DATA_POINTS) {
      return { prediction: null, confidence: 0, method: 'insufficient_data' };
    }

    const processor = new TimeSeriesProcessor();
    processor.data = data;
    const trend = processor.detectTrends(metric);

    if (trend.confidence < PREDICTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) {
      return { prediction: null, confidence: trend.confidence, method: 'low_confidence' };
    }

    // Extrapolate based on the trend
    const hoursFromStart = data.length;
    const predictedValue = trend.slope * (hoursFromStart + hoursAhead) + trend.intercept;

    return {
      prediction: Math.max(0, predictedValue),
      confidence: trend.confidence,
      method: 'linear_extrapolation',
      trend: trend.trend,
      slope: trend.slope
    };
  }

  /**
   * Moving average with trend model
   */
  movingAverageWithTrend(data, metric, hoursAhead, windowSize = 24) {
    if (data.length < windowSize) {
      return { prediction: null, confidence: 0, method: 'insufficient_data' };
    }

    const values = data.map(d => d[metric]).filter(v => v !== undefined && v !== null);
    const recentValues = values.slice(-windowSize);
    
    // Calculate moving average
    const movingAverage = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calculate trend from recent data
    const processor = new TimeSeriesProcessor();
    processor.data = data.slice(-windowSize);
    const trend = processor.detectTrends(metric);
    
    // Apply trend to the moving average
    const trendAdjustment = trend.slope * hoursAhead;
    const prediction = movingAverage + trendAdjustment;
    
    // Calculate confidence based on data stability
    const recentVariance = recentValues.reduce((sum, val) => sum + Math.pow(val - movingAverage, 2), 0) / recentValues.length;
    const stability = Math.max(0, 1 - (recentVariance / movingAverage));
    const confidence = Math.min(stability, trend.confidence);

    return {
      prediction: Math.max(0, prediction),
      confidence,
      method: 'moving_average_with_trend',
      movingAverage,
      trendAdjustment,
      stability
    };
  }

  /**
   * Exponential smoothing model
   */
  exponentialSmoothing(data, metric, hoursAhead, alpha = 0.3) {
    if (data.length < 3) {
      return { prediction: null, confidence: 0, method: 'insufficient_data' };
    }

    const values = data.map(d => d[metric]).filter(v => v !== undefined && v !== null);
    
    // Initialize with first value
    let smoothed = values[0];
    let trend = values[1] - values[0];
    
    // Apply exponential smoothing
    for (let i = 1; i < values.length; i++) {
      const previousSmoothed = smoothed;
      smoothed = alpha * values[i] + (1 - alpha) * (smoothed + trend);
      trend = alpha * (smoothed - previousSmoothed) + (1 - alpha) * trend;
    }

    // Predict future value
    const prediction = smoothed + trend * hoursAhead;
    
    // Calculate confidence based on recent prediction accuracy
    const errors = [];
    let testSmoothed = values[0];
    let testTrend = values[1] - values[0];
    
    for (let i = 1; i < Math.min(values.length, 20); i++) {
      const predicted = testSmoothed + testTrend;
      const actual = values[i];
      const error = Math.abs(predicted - actual) / Math.max(actual, 1);
      errors.push(error);
      
      // Update for next iteration
      const prevTestSmoothed = testSmoothed;
      testSmoothed = alpha * actual + (1 - alpha) * (testSmoothed + testTrend);
      testTrend = alpha * (testSmoothed - prevTestSmoothed) + (1 - alpha) * testTrend;
    }
    
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const confidence = Math.max(0, 1 - avgError);

    return {
      prediction: Math.max(0, prediction),
      confidence,
      method: 'exponential_smoothing',
      smoothedValue: smoothed,
      trend: trend,
      averageError: avgError
    };
  }

  /**
   * Seasonal decomposition model
   */
  seasonalModel(data, metric, hoursAhead) {
    if (data.length < PREDICTION_CONFIG.MIN_DATA_POINTS) {
      return { prediction: null, confidence: 0, method: 'insufficient_data' };
    }

    const processor = new TimeSeriesProcessor();
    processor.data = data;
    
    const trend = processor.detectTrends(metric);
    const seasonality = processor.detectSeasonality(metric);
    
    if (!seasonality.hasSeasonality) {
      return this.movingAverageWithTrend(data, metric, hoursAhead);
    }

    // Get the seasonal component for the predicted hour
    const lastTimestamp = data[data.length - 1].timestamp;
    const predictedTimestamp = new Date(lastTimestamp.getTime() + hoursAhead * 60 * 60 * 1000);
    const predictedHour = predictedTimestamp.getHours();
    const seasonalComponent = seasonality.pattern[predictedHour];

    // Combine trend and seasonal components
    const baseValue = seasonality.overallAverage;
    const trendAdjustment = trend.slope * hoursAhead;
    const prediction = baseValue + trendAdjustment + (seasonalComponent - baseValue);

    const confidence = Math.min(trend.confidence, 0.8); // Cap confidence for seasonal models

    return {
      prediction: Math.max(0, prediction),
      confidence,
      method: 'seasonal_decomposition',
      baseValue,
      trendAdjustment,
      seasonalComponent,
      predictedHour
    };
  }

  /**
   * Ensemble prediction combining multiple models
   */
  ensemblePrediction(data, metric, hoursAhead) {
    const models = [
      this.linearExtrapolation(data, metric, hoursAhead),
      this.movingAverageWithTrend(data, metric, hoursAhead),
      this.exponentialSmoothing(data, metric, hoursAhead),
      this.seasonalModel(data, metric, hoursAhead)
    ];

    const validModels = models.filter(m => m.prediction !== null && m.confidence > 0.3);
    
    if (validModels.length === 0) {
      return { prediction: null, confidence: 0, method: 'no_valid_models' };
    }

    // Weight predictions by confidence
    const totalWeight = validModels.reduce((sum, m) => sum + m.confidence, 0);
    const weightedPrediction = validModels.reduce((sum, m) => sum + m.prediction * m.confidence, 0) / totalWeight;
    const averageConfidence = totalWeight / validModels.length;

    return {
      prediction: weightedPrediction,
      confidence: averageConfidence,
      method: 'ensemble',
      modelCount: validModels.length,
      individualModels: validModels.map(m => ({ method: m.method, prediction: m.prediction, confidence: m.confidence }))
    };
  }
}

/**
 * Health Risk Assessment
 */
class HealthRiskAssessment {
  constructor() {
    this.riskFactors = {};
    this.thresholds = {
      healthScore: { critical: 70, warning: 85 },
      dbLatency: { critical: 2000, warning: 1000 },
      queueBacklog: { critical: 100, warning: 50 },
      successRate: { critical: 90, warning: 95 },
      responseTime: { critical: 1500, warning: 800 }
    };
  }

  /**
   * Assess risk based on predicted values
   */
  assessRisk(predictions, currentValues) {
    const risks = [];

    for (const [metric, prediction] of Object.entries(predictions)) {
      if (!prediction || prediction.prediction === null) continue;

      const risk = this.calculateMetricRisk(metric, prediction, currentValues[metric]);
      if (risk) {
        risks.push(risk);
      }
    }

    return this.prioritizeRisks(risks);
  }

  /**
   * Calculate risk for a specific metric
   */
  calculateMetricRisk(metric, prediction, currentValue) {
    const threshold = this.thresholds[metric];
    if (!threshold) return null;

    const predictedValue = prediction.prediction;
    const confidence = prediction.confidence;

    let severity = 'info';
    let riskScore = 0;

    // Determine severity based on predicted value
    if (metric === 'successRate') {
      // For success rate, lower is worse
      if (predictedValue < threshold.critical) {
        severity = 'critical';
        riskScore = 0.9;
      } else if (predictedValue < threshold.warning) {
        severity = 'warning';
        riskScore = 0.6;
      }
    } else {
      // For other metrics, higher is worse
      if (predictedValue > threshold.critical) {
        severity = 'critical';
        riskScore = 0.9;
      } else if (predictedValue > threshold.warning) {
        severity = 'warning';
        riskScore = 0.6;
      }
    }

    if (severity === 'info') return null;

    // Adjust risk score by confidence
    riskScore *= confidence;

    // Calculate time to impact
    const timeToImpact = this.calculateTimeToImpact(currentValue, predictedValue, prediction);

    return {
      metric,
      severity,
      riskScore,
      confidence,
      currentValue,
      predictedValue,
      threshold: threshold[severity],
      timeToImpact,
      description: this.generateRiskDescription(metric, severity, predictedValue, timeToImpact),
      recommendations: this.generateRecommendations(metric, severity)
    };
  }

  /**
   * Calculate estimated time until the risk materializes
   */
  calculateTimeToImpact(currentValue, predictedValue, prediction) {
    if (prediction.method === 'ensemble' && prediction.individualModels) {
      // Use the linear model for time estimation if available
      const linearModel = prediction.individualModels.find(m => m.method === 'linear_extrapolation');
      if (linearModel && linearModel.slope) {
        const threshold = this.getThresholdForValue(currentValue, predictedValue);
        if (threshold) {
          const timeHours = (threshold - currentValue) / linearModel.slope;
          return Math.max(0, timeHours);
        }
      }
    }

    // Fallback: assume linear degradation
    if (Math.abs(predictedValue - currentValue) > 0.1) {
      return 24; // Assume 24 hours if we can't calculate precisely
    }

    return null; // No clear time to impact
  }

  /**
   * Get appropriate threshold for a value
   */
  getThresholdForValue(currentValue, predictedValue) {
    // Simple heuristic to determine which threshold to use
    const change = Math.abs(predictedValue - currentValue);
    return change > currentValue * 0.2 ? predictedValue : null;
  }

  /**
   * Generate human-readable risk description
   */
  generateRiskDescription(metric, severity, predictedValue, timeToImpact) {
    const metricNames = {
      healthScore: 'system health score',
      dbLatency: 'database response time',
      queueBacklog: 'queue backlog',
      successRate: 'success rate',
      responseTime: 'response time'
    };

    const metricName = metricNames[metric] || metric;
    const timeText = timeToImpact ? ` in approximately ${Math.round(timeToImpact)} hours` : '';
    
    return `${severity.toUpperCase()}: ${metricName} predicted to reach ${predictedValue.toFixed(1)}${timeText}`;
  }

  /**
   * Generate recommendations based on risk
   */
  generateRecommendations(metric, severity) {
    const recommendations = {
      healthScore: {
        warning: ['Monitor system components', 'Review recent changes', 'Check for resource constraints'],
        critical: ['Immediate system review required', 'Consider scaling resources', 'Activate incident response']
      },
      dbLatency: {
        warning: ['Optimize database queries', 'Check connection pool settings', 'Monitor database load'],
        critical: ['Scale database resources', 'Implement query optimization', 'Consider read replicas']
      },
      queueBacklog: {
        warning: ['Scale queue workers', 'Review job processing efficiency', 'Monitor for failed jobs'],
        critical: ['Immediate worker scaling', 'Implement job prioritization', 'Review queue architecture']
      },
      successRate: {
        warning: ['Investigate error patterns', 'Review system dependencies', 'Check monitoring alerts'],
        critical: ['Immediate investigation required', 'Implement fallback mechanisms', 'Consider service degradation']
      },
      responseTime: {
        warning: ['Optimize application performance', 'Review caching strategies', 'Monitor external dependencies'],
        critical: ['Immediate performance optimization', 'Implement request throttling', 'Scale application resources']
      }
    };

    return recommendations[metric]?.[severity] || ['Review system performance', 'Contact system administrator'];
  }

  /**
   * Prioritize risks by severity and confidence
   */
  prioritizeRisks(risks) {
    const severityWeights = { critical: 3, warning: 2, info: 1 };
    
    return risks.sort((a, b) => {
      const aWeight = severityWeights[a.severity] * a.confidence;
      const bWeight = severityWeights[b.severity] * b.confidence;
      return bWeight - aWeight;
    });
  }
}

/**
 * Main Health Predictor
 */
class HealthPredictor {
  constructor() {
    this.processor = new TimeSeriesProcessor();
    this.models = new PredictiveModels();
    this.riskAssessment = new HealthRiskAssessment();
    this.lastPrediction = null;
    this.running = false;
  }

  /**
   * Start predictive monitoring
   */
  async start() {
    if (this.running) return;
    
    console.log('🔮 Starting Predictive Health Forecasting...');
    this.running = true;

    // Initial prediction
    await this.generatePredictions();

    // Schedule regular predictions
    this.interval = setInterval(async () => {
      await this.generatePredictions();
    }, PREDICTION_CONFIG.MODEL_REFRESH_HOURS * 60 * 60 * 1000);

    console.log(`✅ HEALTH PREDICTOR STARTED - forecasting every ${PREDICTION_CONFIG.MODEL_REFRESH_HOURS} hours`);
  }

  /**
   * Stop predictive monitoring
   */
  stop() {
    if (!this.running) return;
    
    console.log('🛑 Stopping Health Predictor...');
    this.running = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('✅ Health Predictor stopped');
  }

  /**
   * Generate comprehensive health predictions
   */
  async generatePredictions() {
    try {
      console.log('🔮 Generating health predictions...');
      
      // Load historical data
      const data = await this.processor.loadHistoricalData();
      if (data.length < PREDICTION_CONFIG.MIN_DATA_POINTS) {
        console.log('⚠️ Insufficient historical data for reliable predictions');
        return null;
      }

      const predictions = {};
      const currentValues = {};
      const metrics = ['healthScore', 'dbLatency', 'queueBacklog', 'successRate', 'responseTime'];

      // Get current values (last data point)
      const latest = data[data.length - 1];
      metrics.forEach(metric => {
        currentValues[metric] = latest[metric];
      });

      // Generate predictions for different time horizons
      for (const metric of metrics) {
        predictions[metric] = {
          shortTerm: this.models.ensemblePrediction(data, metric, PREDICTION_CONFIG.SHORT_TERM_HOURS),
          mediumTerm: this.models.ensemblePrediction(data, metric, PREDICTION_CONFIG.MEDIUM_TERM_HOURS),
          longTerm: this.models.ensemblePrediction(data, metric, PREDICTION_CONFIG.LONG_TERM_HOURS)
        };
      }

      // Assess risks
      const shortTermRisks = this.riskAssessment.assessRisk(
        Object.fromEntries(metrics.map(m => [m, predictions[m].shortTerm])),
        currentValues
      );

      const mediumTermRisks = this.riskAssessment.assessRisk(
        Object.fromEntries(metrics.map(m => [m, predictions[m].mediumTerm])),
        currentValues
      );

      const result = {
        timestamp: new Date().toISOString(),
        dataPoints: data.length,
        currentValues,
        predictions,
        risks: {
          shortTerm: shortTermRisks,
          mediumTerm: mediumTermRisks
        },
        summary: this.generatePredictionSummary(predictions, shortTermRisks, mediumTermRisks)
      };

      this.lastPrediction = result;

      // Store predictions in database
      await this.storePredictions(result);

      // Log summary
      const criticalRisks = [...shortTermRisks, ...mediumTermRisks].filter(r => r.severity === 'critical');
      if (criticalRisks.length > 0) {
        console.log(`🚨 ${criticalRisks.length} critical risk(s) predicted`);
        criticalRisks.forEach(risk => console.log(`   • ${risk.description}`));
      } else {
        console.log('✅ No critical risks predicted in forecast period');
      }

      return result;
    } catch (error) {
      console.error('❌ Health prediction failed:', error.message);
      return null;
    }
  }

  /**
   * Generate a summary of predictions
   */
  generatePredictionSummary(predictions, shortTermRisks, mediumTermRisks) {
    const allRisks = [...shortTermRisks, ...mediumTermRisks];
    const criticalCount = allRisks.filter(r => r.severity === 'critical').length;
    const warningCount = allRisks.filter(r => r.severity === 'warning').length;

    let overallStatus = 'healthy';
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 0) {
      overallStatus = 'warning';
    }

    // Calculate prediction confidence
    const allPredictions = Object.values(predictions).flatMap(p => Object.values(p));
    const validPredictions = allPredictions.filter(p => p.prediction !== null);
    const avgConfidence = validPredictions.length > 0 
      ? validPredictions.reduce((sum, p) => sum + p.confidence, 0) / validPredictions.length 
      : 0;

    return {
      overallStatus,
      criticalRisks: criticalCount,
      warningRisks: warningCount,
      averageConfidence: avgConfidence,
      predictionQuality: avgConfidence >= PREDICTION_CONFIG.HIGH_CONFIDENCE_THRESHOLD ? 'high' :
                        avgConfidence >= PREDICTION_CONFIG.MIN_CONFIDENCE_THRESHOLD ? 'medium' : 'low',
      recommendedActions: this.getRecommendedActions(allRisks)
    };
  }

  /**
   * Get recommended actions based on predicted risks
   */
  getRecommendedActions(risks) {
    const actions = new Set();
    
    risks.forEach(risk => {
      risk.recommendations.forEach(rec => actions.add(rec));
    });

    return Array.from(actions).slice(0, 5); // Top 5 recommendations
  }

  /**
   * Store predictions in database
   */
  async storePredictions(predictions) {
    try {
      const query = `
        INSERT INTO health_predictions (
          prediction_data, overall_status, critical_risks, warning_risks,
          average_confidence, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await pool.query(query, [
        JSON.stringify(predictions),
        predictions.summary.overallStatus,
        predictions.summary.criticalRisks,
        predictions.summary.warningRisks,
        predictions.summary.averageConfidence
      ]);
    } catch (error) {
      console.error('❌ Failed to store predictions:', error.message);
    }
  }

  /**
   * Get latest predictions
   */
  getLatestPredictions() {
    return this.lastPrediction;
  }

  /**
   * Get prediction status
   */
  getStatus() {
    return {
      running: this.running,
      lastPrediction: this.lastPrediction?.timestamp,
      dataPoints: this.lastPrediction?.dataPoints || 0,
      overallStatus: this.lastPrediction?.summary?.overallStatus || 'unknown',
      predictionQuality: this.lastPrediction?.summary?.predictionQuality || 'unknown'
    };
  }
}

module.exports = {
  HealthPredictor,
  TimeSeriesProcessor,
  PredictiveModels,
  HealthRiskAssessment,
  PREDICTION_CONFIG
};