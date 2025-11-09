# Spec 55: Beta-Grouped Portfolio Analysis

## Overview
Analyze portfolio backtest results by grouping stocks by beta value ranges to determine if certain volatility profiles (e.g., high-beta stocks) deliver superior performance.

## Business Requirements

### BR-1: Beta Range Grouping
**Requirement**: Group portfolio backtest stocks into 5 beta ranges based on market volatility
- **Range 1**: 0.00 - 0.50 (Low volatility, defensive stocks)
- **Range 2**: 0.50 - 1.00 (Below-market volatility)
- **Range 3**: 1.00 - 1.50 (Market-level volatility)
- **Range 4**: 1.50 - 2.00 (High volatility)
- **Range 5**: > 2.00 (Very high volatility)

**Rationale**: Different beta ranges represent fundamentally different risk/return profiles

### BR-2: Performance Metrics Per Beta Group
**Requirement**: Calculate and display comprehensive performance metrics for each beta group, organized into 4 categories:

#### Category 1: Performance Metrics (Standard)
- **Total Return %**: Overall return as percentage of deployed capital
- **Total Return $**: Absolute dollar return
- **CAGR %**: Compound Annual Growth Rate
- **Max Drawdown %**: Largest peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return (return / volatility)
- **Sortino Ratio**: Downside risk-adjusted return (return / downside volatility)

#### Category 2: Trading Effectiveness (How well DCA mechanics work)
- **Win Rate %**: Percentage of profitable trades
- **Profit Factor**: Total profit / |Total loss|
- **Average Profit per Trade $**: Average profit on winning trades
- **Average Loss per Trade $**: Average loss on losing trades
- **Trade Frequency**: Trades per stock per year (reveals activity level)
- **Mean Reversion Score %**: Percentage of buy lots that were eventually sold at profit (not stop loss)

#### Category 3: Capital Efficiency (How well capital is utilized)
- **Average Capital Utilization %**: Average % of allocated capital deployed over time
- **Capital Utilization Over Time**: Time-series chart showing deployment trends
- **Capital Turnover Ratio**: Total capital traded / Average deployed capital (how many times capital is recycled)
- **Profit per Day of Deployment $**: Total profit / Sum(capital × days held) (capital productivity)

#### Category 4: Strategy Suitability (DCA-specific applicability)
- **Grid Utilization Rate %**: Average lots held / Max lots allowed (how actively strategy averages down)
- **Drawdown Recovery Time**: Average days from max drawdown to recovery (mean reversion speed)
- **Average Holding Period**: Days between buy and sell (ideal: weeks/months, not years)
- **Opportunity Density**: Trades per $100 of price range (captures volatility effectiveness)
- **DCA Suitability Score**: Composite score combining key suitability metrics (0-100)

**Rationale**:
- **Performance metrics** show "which performed best"
- **Capital efficiency + Strategy suitability metrics** show "which are most suited to DCA strategy"
- The goal is to identify stocks where DCA mechanics (averaging down on dips, taking profits on recovery) work most effectively
- High-return stocks may not be DCA-suitable if they lack volatility or mean reversion patterns

### BR-2.1: DCA Suitability Score Calculation
**Requirement**: Calculate a composite 0-100 score that quantifies how well-suited each beta group is for DCA strategy

**Formula Components** (each weighted 0-25 points):
1. **Trade Activity Score** (25 points max)
   - Based on: Trade frequency and opportunity density
   - High frequency (>12 trades/stock/year) = 25 points
   - Medium frequency (6-12) = 15 points
   - Low frequency (<6) = 5 points

2. **Mean Reversion Score** (25 points max)
   - Based on: % of buy lots sold at profit and drawdown recovery time
   - High reversion (>75% profitable exits, <60 day recovery) = 25 points
   - Medium reversion (50-75%, 60-120 days) = 15 points
   - Low reversion (<50%, >120 days) = 5 points

3. **Capital Efficiency Score** (25 points max)
   - Based on: Capital utilization % and profit per day of deployment
   - High efficiency (>70% utilization, >$5/day/1K deployed) = 25 points
   - Medium efficiency (50-70%, $2-5/day/1K) = 15 points
   - Low efficiency (<50%, <$2/day/1K) = 5 points

4. **Grid Utilization Score** (25 points max)
   - Based on: Average lots held / max lots
   - Optimal utilization (60-80% - actively averaging down but not always maxed out) = 25 points
   - Moderate utilization (40-60% or 80-100%) = 15 points
   - Poor utilization (<40% - rarely averages down) = 5 points

**Total Score**: Sum of 4 components (0-100)

**Interpretation**:
- **80-100**: Excellent DCA suitability - Strategy actively engages, capital efficient, strong mean reversion
- **60-79**: Good DCA suitability - Strategy works well with some room for improvement
- **40-59**: Moderate DCA suitability - Strategy provides some value but may not be optimal
- **0-39**: Poor DCA suitability - Consider alternative strategies or stock selection

**Example Scenarios**:
- **High-beta tech stocks (β > 2.0)**: May score high on trade activity (volatile) but low on mean reversion (erratic movements)
- **Low-beta defensive stocks (β < 0.5)**: May score low on trade activity (stable) but high on mean reversion (predictable)
- **Market-beta stocks (β 1.0-1.5)**: May score highest overall - balanced volatility with mean reversion

### BR-3: Stock-Level Attribution
**Requirement**: Show individual stock performance within each beta group
- Display top 5 performers and bottom 5 performers per group
- Show beta value alongside each stock's performance
- Show DCA suitability score for each stock
- Enable drill-down to full stock details

**Rationale**: Verify that performance is consistent across stocks in the group, not driven by outliers. Identify individual stocks with best DCA suitability within each beta range.

### BR-4: Cross-Group Comparison
**Requirement**: Provide visual and tabular comparison across all beta groups
- Side-by-side metrics table
- Bar charts for key metrics (return %, CAGR, win rate)
- Highlight best-performing and worst-performing groups

**Rationale**: Make it easy to identify which beta range delivers optimal risk-adjusted returns

## Technical Requirements

### TR-1: Beta Data Integration
**Requirement**: Leverage existing beta data infrastructure
- Use `betaDataService.js` to fetch beta values
- Support both Yahoo Finance (primary) and Alpha Vantage (fallback)
- Cache beta values with 7-day expiry
- Handle missing/unavailable beta gracefully (default to 1.0)

**Current Implementation**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/betaDataService.js` (singleton instance)
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/analyze_nasdaq100_beta.js` (analysis script)

### TR-2: Portfolio Backtest Result Extension
**Requirement**: Extend portfolio backtest response to include beta grouping metadata
- Add `betaGrouping` object to response
- Include per-stock beta values in individual stock results
- Calculate group-level aggregations during backtest execution

**API Response Structure**:
```json
{
  "success": true,
  "data": {
    "portfolioSummary": { ... },
    "stockResults": [ ... ],
    "betaGrouping": {
      "groups": [
        {
          "range": "0.00 - 0.50",
          "minBeta": 0,
          "maxBeta": 0.5,
          "stockCount": 14,
          "stocks": ["BIIB", "KHC", "AZN", ...],
          "performance": {
            "totalReturnPercent": 12.5,
            "totalReturnDollar": 45000,
            "cagrPercent": 8.2,
            "winRate": 65.3,
            "avgProfitPerTrade": 850,
            "avgLossPerTrade": -420,
            "totalTrades": 156,
            "deployedCapital": 350000
          }
        },
        // ... other groups
      ],
      "summary": {
        "totalStocks": 105,
        "avgBeta": 1.18,
        "medianBeta": 1.09
      }
    }
  }
}
```

### TR-3: Initial Simplification - Independent Stock Treatment
**Requirement**: Phase 1 implementation assumes stocks can be treated independently
- **Assumption**: Portfolio has sufficient capital (no rejected buys)
- **Rationale**: Capital constraints create interdependencies between stocks
- **Implication**: Each stock's performance can be directly attributed to its beta group
- **Future Enhancement**: Account for capital allocation competition in Phase 2

### TR-4: Backend Analysis Service
**Requirement**: Create `betaGroupAnalysisService.js` to:
1. Fetch beta values for all portfolio stocks
2. Classify stocks into beta ranges
3. Aggregate performance metrics per group
4. Generate comparison statistics

**Service Location**: `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/betaGroupAnalysisService.js`

### TR-5: Frontend Display Components
**Requirement**: Create UI components to visualize beta-grouped analysis
- Beta Group Summary Table (all groups, key metrics)
- Beta Group Detail View (individual group, top/bottom performers)
- Comparison Charts (bar charts, performance trends)

**Component Location**: `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/BetaGroupAnalysis.js`

## Data Requirements

### DR-1: NASDAQ-100 Beta Distribution (Baseline)
**Data Source**: Yahoo Finance via yfinance Python library (97.1% coverage)

**Current Distribution** (as of analysis):
- **0.00 - 0.50**: 14 stocks (13.3%) - BIIB, KHC, AZN, REGN, TRI, GILD, XEL, JD, VRTX, KDP, PEP, MDLZ, EXC, AMGN
- **0.50 - 1.00**: 22 stocks (21.0%) - TMUS, CCEP, ORLY, EA, ZM, LCID, ADP, VRSK, DLTR, CSGP, PAYX, TEAM, CMCSA, LIN, FAST, CTSH, BKR, COST, PANW, CDNS, CSCO, SBUX
- **1.00 - 1.50**: 50 stocks (47.6%) - GOOG, GOOGL, SGEN, SPLK, TSLA, ROP, TXN, CDW, FANG, TTWO, MSFT, CPRT, HON, CHTR, ZS, LULU, FTNT, SNPS, ABNB, AAPL, CEG, WDAY, CRWD, ROST, ODFL, DDOG, META, QCOM, INTU, ASML, GEHC, CSX, AMZN, EBAY, INTC, TTD, ILMN, BKNG, AXON, PYPL, NXPI, MELI, DXCM, ADBE, KLAC, ON, GFS, ADSK, PLTR
- **1.50 - 2.00**: 13 stocks (12.4%) - MCHP, SMCI, ENPH, MU, IDXX, ISRG, ALGN, DASH, WBD, AMAT, RIVN, LRCX, MRVL
- **> 2.00**: 6 stocks (5.7%) - MRNA, NVDA, APP, SHOP, MSTR, ARM

**Statistics**:
- Average Beta: 1.18
- Median Beta: 1.09
- Min Beta: 0.13 (BIIB, KHC)
- Max Beta: 4.12 (ARM)

### DR-2: Portfolio Configuration
**Test Portfolio**: `nasdaq100.json`
- Total Capital: $3,000,000
- Margin: 20%
- Lot Size: $5,000 (base)
- Beta Scaling: ENABLED
- Start Date: 2021-09-02
- End Date: 2025-10-22

## User Stories

### US-1: Identify DCA-Suitable Stocks by Beta Group
**As a** portfolio manager using DCA strategy
**I want to** see which beta groups have the highest DCA suitability scores
**So that** I can select stocks where DCA strategy mechanics work most effectively

**Acceptance Criteria**:
- Display DCA suitability score (0-100) for each beta group
- Show breakdown of score components (trade activity, mean reversion, capital efficiency, grid utilization)
- Highlight beta group(s) with score >80 (excellent DCA suitability)
- Show capital utilization over time chart to visualize deployment patterns
- Show trade frequency per group to understand activity levels

**Example Insight**: "Market-beta stocks (β 1.0-1.5) score 85/100 for DCA suitability with high capital efficiency (75% utilization) and strong mean reversion (68% profitable exits), making them ideal for this strategy."

### US-2: Analyze Capital Deployment Patterns
**As a** capital allocation analyst
**I want to** see how capital is deployed across beta groups over time
**So that** I can understand which volatility profiles tie up capital vs. recycle it efficiently

**Acceptance Criteria**:
- Time-series chart showing average capital utilization % for each beta group
- Display capital turnover ratio (how many times capital is recycled)
- Show profit per day of capital deployment (capital productivity)
- Identify groups with low utilization (capital sitting idle) vs. high turnover (active trading)

**Example Insight**: "High-beta stocks (β 1.5-2.0) show 85% capital utilization but only 1.2x turnover, meaning capital is deployed but held for long periods. Market-beta stocks show 70% utilization but 3.5x turnover, meaning capital is more actively recycled."

### US-3: Evaluate Trade Frequency and Opportunity Density
**As a** strategy analyst
**I want to** see trade frequency and opportunity density per beta group
**So that** I can determine which volatility profiles create enough trading opportunities for DCA to be effective

**Acceptance Criteria**:
- Display trades per stock per year for each beta group
- Show opportunity density (trades per $100 price range)
- Identify groups with insufficient trading activity (<6 trades/stock/year)
- Compare trade frequency vs. performance to identify "sweet spot"

**Example Insight**: "Very high-beta stocks (β >2) have 18 trades/stock/year but only 45% win rate (erratic volatility). Market-beta stocks have 12 trades/stock/year with 68% win rate (productive volatility)."

### US-4: View Beta Group Performance Summary
**As a** portfolio analyst
**I want to** see performance metrics grouped by beta range
**So that** I can identify which volatility profiles deliver the best returns

**Acceptance Criteria**:
- Display 5 beta groups with total return %, CAGR, win rate, stock count
- Highlight best and worst performing groups
- Show overall portfolio statistics (avg beta, median beta)

### US-5: Investigate High-Beta Performance
**As a** portfolio manager
**I want to** drill down into high-beta stocks (>1.5)
**So that** I can determine if aggressive stocks justify their risk

**Acceptance Criteria**:
- Filter to show only stocks with beta > 1.5
- Display individual stock performance within this group
- Compare aggregated high-beta performance vs. overall portfolio
- Show DCA suitability score for high-beta stocks

### US-6: Compare Beta Groups Side-by-Side
**As a** risk analyst
**I want to** compare all beta groups visually
**So that** I can understand the risk/return tradeoff across volatility profiles

**Acceptance Criteria**:
- Bar charts showing return %, CAGR, win rate, DCA suitability score per group
- Tabular comparison with sortable columns
- Export comparison data to CSV

## Success Criteria

1. **Accuracy**: Beta grouping matches actual Yahoo Finance beta values (97%+ real data)
2. **Performance**: Analysis completes within 2 seconds for 105-stock portfolio
3. **Usability**: Clear visual distinction between beta groups, easy to identify best performers
4. **Actionable**: User can answer "Should I focus on high-beta or low-beta stocks?" based on results

## Future Enhancements (Phase 2)

1. **Capital Constraint Awareness**: Account for rejected buys due to capital limits
2. **Time-Series Analysis**: Show how beta group performance evolves over time
3. **Custom Beta Ranges**: Allow user to define custom beta groupings
4. **Risk-Adjusted Metrics**: Include Sharpe ratio, Sortino ratio per beta group
5. **Sector Integration**: Combine beta grouping with sector analysis

## Related Specs

- **Spec 43**: Beta scaling in standalone backtest mode
- **Spec 49**: Portfolio backtest margin support
- **Spec 50**: Portfolio beta scaling support

## References

- Beta Analysis Script: `backend/analyze_nasdaq100_beta.js`
- Beta Data Service: `backend/services/betaDataService.js`
- Portfolio Config: `backend/configs/portfolios/nasdaq100.json`
- Bug Report 02: Portfolio capital leak investigation (margin validation context)
