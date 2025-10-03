/**
 * DCA Scenario Detection Service
 *
 * Analyzes backtest results to classify market scenarios and provide
 * adaptive strategy recommendations.
 */

// Scenario type constants
const SCENARIO_TYPES = {
  DOWNTREND: 'downtrend',
  MISSED_RALLY: 'missed_rally',
  OSCILLATING_UPTREND: 'oscillating_uptrend',
  MIXED: 'mixed'
};

// Configuration thresholds for scenario detection
const SCENARIO_THRESHOLDS = {
  downtrend: {
    totalReturn: -0.10,        // Total return < -10%
    capitalUtilization: 0.70,  // Capital usage > 70%
    unrealizedPnL: 0,          // Unrealized PnL < 0
    unrealizedToRealized: 1.0  // |unrealized| > |realized|
  },
  missed_rally: {
    totalTrades: 5,            // Total trades < 5
    capitalUtilization: 0.30,  // Capital usage < 30%
    opportunityCostRatio: 2.0  // Buy-and-hold return > DCA return * 2
  },
  oscillating_uptrend: {
    totalReturn: 0,            // Total return > 0
    winRate: 0.70,             // Win rate > 70%
    totalTrades: 10            // Total trades > 10
  }
};

/**
 * Main entry point for scenario detection
 * @param {Object} backtestResult - Complete backtest result object
 * @param {boolean} enableScenarioDetection - Flag to enable/disable feature
 * @returns {Object|null} Scenario analysis object or null if disabled
 */
function detectScenario(backtestResult, enableScenarioDetection = true) {
  console.log('🎯 Scenario Detection Called:', { enableScenarioDetection });

  // Return null if feature is disabled
  if (!enableScenarioDetection) {
    console.log('⚠️ Scenario detection is DISABLED');
    return null;
  }

  try {
    console.log('✅ Scenario detection is ENABLED - analyzing...');
    console.log('📦 Backtest Result sample:', { totalReturn: backtestResult.totalReturn, realizedPNL: backtestResult.realizedPNL, totalTrades: backtestResult.totalTrades });
    // Extract relevant metrics from backtest result
    const metrics = extractMetrics(backtestResult);
    console.log('📊 Metrics extracted:', { totalReturn: metrics.totalReturn, winRate: metrics.winRate, totalTrades: metrics.totalTrades });

    // Classify the scenario
    const scenario = classifyScenario(metrics);
    console.log('🎬 Scenario classified:', scenario.type);

    // Calculate confidence score
    const confidence = calculateConfidence(scenario.type, metrics);

    // Generate recommendations based on scenario
    const recommendations = generateRecommendations(scenario.type, metrics);

    // Calculate enhanced risk metrics
    const enhancedRiskMetrics = calculateEnhancedRiskMetrics(metrics, backtestResult);

    return {
      type: scenario.type,
      confidence: confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      keyMetrics: scenario.keyMetrics,
      analysis: scenario.analysis,
      recommendations: recommendations,
      enhancedRiskMetrics: enhancedRiskMetrics
    };
  } catch (error) {
    console.error('Error in scenario detection:', error);
    // Graceful degradation - return null on error
    return null;
  }
}

/**
 * Extract relevant metrics from backtest result
 * @param {Object} result - Backtest result object
 * @returns {Object} Extracted metrics
 */
function extractMetrics(result) {
  const totalTrades = result.totalTrades || 0;
  const winningTrades = result.winningTrades || 0;
  const losingTrades = result.losingTrades || 0;
  const totalReturn = result.totalReturn || 0;
  const buyAndHoldReturn = result.buyAndHoldReturn || 0;
  const realizedPnL = result.realizedPnL || 0;
  const unrealizedPnL = result.unrealizedPnL || 0;
  const maxCapitalDeployed = result.maxCapitalDeployed || 0;
  const maxLots = result.backtestParameters?.maxLots || 10;
  const lotSizeUsd = result.backtestParameters?.lotSizeUsd || 10000;
  const maxDrawdown = result.maxDrawdown || 0;
  const transactions = result.transactions || [];

  // Calculate derived metrics
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
  const maxPossibleCapital = maxLots * lotSizeUsd;
  const capitalUtilization = maxPossibleCapital > 0 ? maxCapitalDeployed / maxPossibleCapital : 0;
  const opportunityCost = buyAndHoldReturn - totalReturn;
  const opportunityCostRatio = totalReturn !== 0 ? buyAndHoldReturn / totalReturn : 0;

  // Count buy vs sell transactions
  const buyTransactions = transactions.filter(t => t.type === 'BUY').length;
  const sellTransactions = transactions.filter(t => t.type === 'SELL').length;
  const buySellRatio = sellTransactions > 0 ? buyTransactions / sellTransactions : buyTransactions;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalReturn,
    buyAndHoldReturn,
    realizedPnL,
    unrealizedPnL,
    maxCapitalDeployed,
    capitalUtilization,
    opportunityCost,
    opportunityCostRatio,
    buyTransactions,
    sellTransactions,
    buySellRatio,
    maxDrawdown,
    transactions,
    maxLots,
    lotSizeUsd
  };
}

/**
 * Classify the scenario based on extracted metrics
 * @param {Object} metrics - Extracted metrics
 * @returns {Object} Scenario classification with key metrics and analysis
 */
function classifyScenario(metrics) {
  // Priority 1: Check for downtrend (highest risk scenario)
  if (isDowntrendScenario(metrics)) {
    return {
      type: SCENARIO_TYPES.DOWNTREND,
      keyMetrics: {
        totalReturn: metrics.totalReturn,
        buyAndHoldReturn: metrics.buyAndHoldReturn,
        capitalUtilization: metrics.capitalUtilization,
        unrealizedPnL: metrics.unrealizedPnL,
        realizedPnL: metrics.realizedPnL,
        buySellRatio: metrics.buySellRatio
      },
      analysis: 'Strategy caught a falling knife - bought into downtrend with limited sell opportunities'
    };
  }

  // Priority 2: Check for missed rally
  if (isFastRallyScenario(metrics)) {
    return {
      type: SCENARIO_TYPES.MISSED_RALLY,
      keyMetrics: {
        totalTrades: metrics.totalTrades,
        totalReturn: metrics.totalReturn,
        buyAndHoldReturn: metrics.buyAndHoldReturn,
        capitalUtilization: metrics.capitalUtilization,
        opportunityCost: metrics.opportunityCost
      },
      analysis: 'Price rallied too quickly - strategy sat in cash while opportunity passed'
    };
  }

  // Priority 3: Check for oscillating uptrend (optimal scenario)
  if (isOscillatingUptrendScenario(metrics)) {
    return {
      type: SCENARIO_TYPES.OSCILLATING_UPTREND,
      keyMetrics: {
        totalReturn: metrics.totalReturn,
        buyAndHoldReturn: metrics.buyAndHoldReturn,
        winRate: metrics.winRate,
        totalTrades: metrics.totalTrades,
        maxDrawdown: metrics.maxDrawdown
      },
      analysis: 'Price oscillated with upward bias - DCA captured dips and peaks effectively'
    };
  }

  // Default: Mixed scenario
  return {
    type: SCENARIO_TYPES.MIXED,
    keyMetrics: {
      totalReturn: metrics.totalReturn,
      buyAndHoldReturn: metrics.buyAndHoldReturn,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate
    },
    analysis: 'Market conditions did not clearly match any specific scenario pattern'
  };
}

/**
 * Check if metrics indicate a downtrend scenario
 * @param {Object} metrics - Extracted metrics
 * @returns {boolean}
 */
function isDowntrendScenario(metrics) {
  const thresholds = SCENARIO_THRESHOLDS.downtrend;

  return (
    metrics.totalReturn < thresholds.totalReturn &&
    metrics.capitalUtilization > thresholds.capitalUtilization &&
    metrics.unrealizedPnL < thresholds.unrealizedPnL &&
    Math.abs(metrics.unrealizedPnL) > Math.abs(metrics.realizedPnL)
  );
}

/**
 * Check if metrics indicate a fast rally (missed opportunity) scenario
 * @param {Object} metrics - Extracted metrics
 * @returns {boolean}
 */
function isFastRallyScenario(metrics) {
  const thresholds = SCENARIO_THRESHOLDS.missed_rally;

  return (
    metrics.totalTrades < thresholds.totalTrades &&
    metrics.capitalUtilization < thresholds.capitalUtilization &&
    metrics.buyAndHoldReturn > metrics.totalReturn * thresholds.opportunityCostRatio
  );
}

/**
 * Check if metrics indicate an oscillating uptrend scenario
 * @param {Object} metrics - Extracted metrics
 * @returns {boolean}
 */
function isOscillatingUptrendScenario(metrics) {
  const thresholds = SCENARIO_THRESHOLDS.oscillating_uptrend;

  return (
    metrics.totalReturn > thresholds.totalReturn &&
    metrics.winRate > thresholds.winRate &&
    metrics.totalTrades > thresholds.totalTrades
  );
}

/**
 * Calculate confidence score for scenario classification
 * @param {string} scenarioType - Detected scenario type
 * @param {Object} metrics - Extracted metrics
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(scenarioType, metrics) {
  const thresholds = getScenarioThresholds(scenarioType);

  if (!thresholds) {
    return 0.5; // Medium confidence for mixed scenario
  }

  let criteriaMet = 0;
  let totalCriteria = 0;

  // Count how many criteria are met and how strongly
  for (const [key, threshold] of Object.entries(thresholds)) {
    totalCriteria++;

    if (meetsThreshold(key, metrics, threshold, scenarioType)) {
      criteriaMet++;
    }
  }

  // Base confidence on percentage of criteria met
  const baseConfidence = criteriaMet / totalCriteria;

  // Adjust confidence based on strength of signals
  let adjustedConfidence = baseConfidence;

  if (scenarioType === SCENARIO_TYPES.DOWNTREND) {
    // Stronger confidence if losses are significantly worse than buy-and-hold
    if (metrics.totalReturn < metrics.buyAndHoldReturn - 0.1) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.1);
    }
  } else if (scenarioType === SCENARIO_TYPES.MISSED_RALLY) {
    // Stronger confidence if opportunity cost is very high
    if (metrics.opportunityCostRatio > 3.0) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.15);
    }
  } else if (scenarioType === SCENARIO_TYPES.OSCILLATING_UPTREND) {
    // Stronger confidence if outperforming buy-and-hold
    if (metrics.totalReturn > metrics.buyAndHoldReturn) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.1);
    }
  }

  return Math.max(0, Math.min(1.0, adjustedConfidence));
}

/**
 * Get thresholds for a specific scenario type
 * @param {string} scenarioType - Scenario type
 * @returns {Object|null} Threshold object or null
 */
function getScenarioThresholds(scenarioType) {
  return SCENARIO_THRESHOLDS[scenarioType] || null;
}

/**
 * Check if a metric meets the threshold for a scenario
 * @param {string} key - Metric key
 * @param {Object} metrics - All metrics
 * @param {number} threshold - Threshold value
 * @param {string} scenarioType - Scenario type
 * @returns {boolean}
 */
function meetsThreshold(key, metrics, threshold, scenarioType) {
  const value = metrics[key];

  if (value === undefined) return false;

  // Different comparison logic based on scenario type
  if (scenarioType === SCENARIO_TYPES.DOWNTREND) {
    if (key === 'totalReturn') return value < threshold;
    if (key === 'capitalUtilization') return value > threshold;
    if (key === 'unrealizedPnL') return value < threshold;
    if (key === 'unrealizedToRealized') return Math.abs(metrics.unrealizedPnL) > Math.abs(metrics.realizedPnL);
  } else if (scenarioType === SCENARIO_TYPES.MISSED_RALLY) {
    if (key === 'totalTrades') return value < threshold;
    if (key === 'capitalUtilization') return value < threshold;
    if (key === 'opportunityCostRatio') return value > threshold;
  } else if (scenarioType === SCENARIO_TYPES.OSCILLATING_UPTREND) {
    if (key === 'totalReturn') return value > threshold;
    if (key === 'winRate') return value > threshold;
    if (key === 'totalTrades') return value > threshold;
  }

  return false;
}

/**
 * Get confidence level label
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Confidence level label
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}

/**
 * Generate actionable recommendations based on scenario
 * @param {string} scenarioType - Detected scenario type
 * @param {Object} metrics - Extracted metrics
 * @returns {Array} List of recommendations
 */
function generateRecommendations(scenarioType, metrics) {
  const recommendations = [];

  if (scenarioType === SCENARIO_TYPES.DOWNTREND) {
    recommendations.push({
      priority: 'critical',
      action: 'Consider implementing stop-loss',
      reason: `High capital deployed (${(metrics.capitalUtilization * 100).toFixed(1)}%) in losing position`,
      suggestion: 'Add stop-loss at -15% to limit downside exposure'
    });

    recommendations.push({
      priority: 'high',
      action: 'Reduce position sizing in downtrends',
      reason: `Unrealized losses (${metrics.unrealizedPnL.toFixed(0)}) exceed realized gains`,
      suggestion: 'Consider using smaller lot sizes or fewer max lots'
    });

    recommendations.push({
      priority: 'high',
      action: 'Use trend filters',
      reason: 'Strategy bought into falling market',
      suggestion: 'Only enter when price is above 200-day moving average'
    });

    if (metrics.buySellRatio > 5) {
      recommendations.push({
        priority: 'medium',
        action: 'Review profit requirements',
        reason: `High buy/sell ratio (${metrics.buySellRatio.toFixed(1)}) indicates few exit opportunities`,
        suggestion: 'Consider lower profit requirements to enable more exits'
      });
    }

  } else if (scenarioType === SCENARIO_TYPES.MISSED_RALLY) {
    recommendations.push({
      priority: 'high',
      action: 'Consider initial position',
      reason: `Low trade count (${metrics.totalTrades}) and capital usage (${(metrics.capitalUtilization * 100).toFixed(1)}%)`,
      suggestion: 'Start with 20-30% initial position to capture quick rallies'
    });

    recommendations.push({
      priority: 'high',
      action: 'Widen grid intervals',
      reason: `Missed ${(metrics.opportunityCost * 100).toFixed(1)}% vs buy-and-hold`,
      suggestion: 'Use wider grid spacing to catch entries in fast markets'
    });

    recommendations.push({
      priority: 'medium',
      action: 'Use aggressive entry on first signal',
      reason: 'Price moved too quickly for gradual entry',
      suggestion: 'Deploy larger initial lot size on first buy signal'
    });

  } else if (scenarioType === SCENARIO_TYPES.OSCILLATING_UPTREND) {
    recommendations.push({
      priority: 'low',
      action: 'Current parameters are working well',
      reason: `Strong performance: ${(metrics.totalReturn * 100).toFixed(1)}% return with ${(metrics.winRate * 100).toFixed(1)}% win rate`,
      suggestion: 'Continue monitoring - consider these parameters for similar conditions'
    });

    if (metrics.totalReturn > metrics.buyAndHoldReturn) {
      recommendations.push({
        priority: 'low',
        action: 'Strategy outperforming buy-and-hold',
        reason: `DCA return ${(metrics.totalReturn * 100).toFixed(1)}% vs B&H ${(metrics.buyAndHoldReturn * 100).toFixed(1)}%`,
        suggestion: 'This is the ideal scenario for DCA strategy'
      });
    }

    recommendations.push({
      priority: 'medium',
      action: 'Document successful parameters',
      reason: 'These settings work well for oscillating uptrends',
      suggestion: 'Save this configuration for stocks with similar patterns'
    });

  } else {
    // Mixed scenario
    recommendations.push({
      priority: 'medium',
      action: 'Market conditions unclear',
      reason: 'No clear scenario pattern detected',
      suggestion: 'Review individual transactions to understand behavior'
    });

    if (metrics.totalReturn < 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider adjusting parameters',
        reason: `Negative return (${(metrics.totalReturn * 100).toFixed(1)}%) but no clear cause`,
        suggestion: 'Try different grid spacing or profit requirements'
      });
    }
  }

  return recommendations;
}

/**
 * Calculate enhanced risk metrics
 * @param {Object} metrics - Extracted metrics
 * @param {Object} backtestResult - Full backtest result
 * @returns {Object} Enhanced risk metrics
 */
function calculateEnhancedRiskMetrics(metrics, backtestResult) {
  // 1. Capital Efficiency Score
  const capitalEfficiencyScore = calculateCapitalEfficiency(metrics, backtestResult);

  // 2. Opportunity Cost (absolute)
  const opportunityCost = metrics.opportunityCost;

  // 3. Scenario Risk Score (0-100)
  const scenarioRiskScore = calculateScenarioRiskScore(metrics);

  // 4. Max Unrealized Drawdown
  const maxUnrealizedDrawdown = calculateMaxUnrealizedDrawdown(backtestResult);

  // 5. Buy/Sell Ratio
  const buySellRatio = metrics.buySellRatio;

  return {
    capitalEfficiencyScore,
    opportunityCost,
    scenarioRiskScore,
    maxUnrealizedDrawdown,
    buySellRatio
  };
}

/**
 * Calculate capital efficiency score
 * @param {Object} metrics - Extracted metrics
 * @param {Object} backtestResult - Full backtest result
 * @returns {number} Efficiency score (0-100)
 */
function calculateCapitalEfficiency(metrics, backtestResult) {
  // Capital efficiency = % of time capital was deployed profitably
  // This is a simplified calculation - could be enhanced with time-weighted analysis

  if (metrics.totalTrades === 0) return 0;

  const profitableDeployment = metrics.winRate * metrics.capitalUtilization;
  return Math.min(100, profitableDeployment * 100);
}

/**
 * Calculate scenario risk score
 * @param {Object} metrics - Extracted metrics
 * @returns {number} Risk score (0-100, where 0=low risk, 100=high risk)
 */
function calculateScenarioRiskScore(metrics) {
  // Higher score = higher risk
  let riskScore = 0;

  // Factor 1: Return risk (40% weight)
  if (metrics.totalReturn < -0.2) {
    riskScore += 40;
  } else if (metrics.totalReturn < -0.1) {
    riskScore += 30;
  } else if (metrics.totalReturn < 0) {
    riskScore += 20;
  } else if (metrics.totalReturn < 0.1) {
    riskScore += 10;
  }

  // Factor 2: Drawdown risk (30% weight)
  if (Math.abs(metrics.maxDrawdown) > 0.3) {
    riskScore += 30;
  } else if (Math.abs(metrics.maxDrawdown) > 0.2) {
    riskScore += 20;
  } else if (Math.abs(metrics.maxDrawdown) > 0.1) {
    riskScore += 10;
  }

  // Factor 3: Capital utilization risk (30% weight)
  if (metrics.capitalUtilization > 0.8 && metrics.totalReturn < 0) {
    riskScore += 30; // High capital deployed in losing position
  } else if (metrics.capitalUtilization < 0.2 && metrics.opportunityCost > 0.2) {
    riskScore += 20; // Low capital usage with high opportunity cost
  }

  return Math.min(100, riskScore);
}

/**
 * Calculate maximum unrealized drawdown during backtest
 * @param {Object} backtestResult - Full backtest result
 * @returns {number} Max unrealized drawdown
 */
function calculateMaxUnrealizedDrawdown(backtestResult) {
  // This would require tracking unrealized PnL throughout the backtest
  // For now, use the final unrealized PnL as a proxy
  // In future, could enhance to track min unrealized PnL throughout backtest

  return backtestResult.unrealizedPnL || 0;
}

module.exports = {
  detectScenario,
  SCENARIO_TYPES,
  SCENARIO_THRESHOLDS
};
