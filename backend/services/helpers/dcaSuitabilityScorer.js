/**
 * DCA Suitability Scorer
 *
 * Calculates a 0-100 score indicating how well-suited stocks are for DCA strategy
 *
 * GENERIC - Can be reused for any factor grouping (beta, revenue growth, etc.)
 */

/**
 * Calculate DCA Suitability Score (0-100)
 *
 * @param {Object} metrics - Performance metrics for a group
 * @returns {Object} Score breakdown with total score
 */
function calculateDCASuitabilityScore(metrics) {
  // Default values if metrics are missing
  const tradeFrequency = metrics.tradeFrequency || 0;
  const meanReversionScore = metrics.meanReversionScore || 0;
  const capitalUtilization = metrics.avgCapitalUtilization || 0;
  const gridUtilization = metrics.gridUtilization || 0;

  // 1. Trade Activity Score (0-25 points)
  let tradeActivityScore = 0;
  if (tradeFrequency >= 12) {
    tradeActivityScore = 25;
  } else if (tradeFrequency >= 6) {
    tradeActivityScore = 15;
  } else if (tradeFrequency > 0) {
    tradeActivityScore = 5;
  }

  // 2. Mean Reversion Score (0-25 points)
  let meanRevScore = 0;
  if (meanReversionScore >= 75) {
    meanRevScore = 25;
  } else if (meanReversionScore >= 50) {
    meanRevScore = 15;
  } else if (meanReversionScore > 0) {
    meanRevScore = 5;
  }

  // 3. Capital Efficiency Score (0-25 points)
  let capitalEfficiencyScore = 0;
  if (capitalUtilization >= 70) {
    capitalEfficiencyScore = 25;
  } else if (capitalUtilization >= 50) {
    capitalEfficiencyScore = 15;
  } else if (capitalUtilization > 0) {
    capitalEfficiencyScore = 5;
  }

  // 4. Grid Utilization Score (0-25 points)
  // Optimal: 60-80% (actively averaging down but not always maxed)
  let gridUtilScore = 0;
  if (gridUtilization >= 60 && gridUtilization <= 80) {
    gridUtilScore = 25;
  } else if ((gridUtilization >= 40 && gridUtilization < 60) || (gridUtilization > 80 && gridUtilization <= 100)) {
    gridUtilScore = 15;
  } else if (gridUtilization > 0) {
    gridUtilScore = 5;
  }

  // Total Score
  const totalScore = tradeActivityScore + meanRevScore + capitalEfficiencyScore + gridUtilScore;

  return {
    totalScore: parseFloat(totalScore.toFixed(1)),
    breakdown: {
      tradeActivity: tradeActivityScore,
      meanReversion: meanRevScore,
      capitalEfficiency: capitalEfficiencyScore,
      gridUtilization: gridUtilScore
    },
    interpretation: getScoreInterpretation(totalScore)
  };
}

/**
 * Get interpretation text for a DCA suitability score
 */
function getScoreInterpretation(score) {
  if (score >= 80) {
    return 'Excellent DCA suitability - Strategy actively engages, capital efficient, strong mean reversion';
  } else if (score >= 60) {
    return 'Good DCA suitability - Strategy works well with some room for improvement';
  } else if (score >= 40) {
    return 'Moderate DCA suitability - Strategy provides some value but may not be optimal';
  } else {
    return 'Poor DCA suitability - Consider alternative strategies or stock selection';
  }
}

module.exports = {
  calculateDCASuitabilityScore,
  getScoreInterpretation
};
