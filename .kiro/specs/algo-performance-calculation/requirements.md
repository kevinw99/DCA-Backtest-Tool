# Requirements Document

## Introduction

This feature enhances the DCA trading platform's performance evaluation capabilities by implementing comprehensive algorithm performance metrics that accurately account for variable capital deployment over time. The system will calculate industry-standard performance metrics while properly handling the multi-leg DCA strategy where capital is deployed incrementally (e.g., $10k initially, growing to $50k over 6 months) rather than all at once.

## Requirements

### Requirement 1: Capital-Aware Performance Metrics

**User Story:** As a trader using DCA strategies, I want performance metrics calculated based on actual capital deployed at different time periods, so that I can accurately assess the efficiency of my capital usage and compare against alternative investment opportunities.

#### Acceptance Criteria

1. WHEN calculating performance metrics THEN the system SHALL use actual deployed capital amounts at each time period rather than maximum available capital
2. WHEN capital deployment varies over time THEN the system SHALL calculate time-weighted returns that account for when capital was deployed
3. WHEN displaying return percentages THEN the system SHALL provide both return on maximum deployed capital and return on average deployed capital
4. IF maximum available capital is $100k but only $50k was ever deployed THEN returns SHALL be calculated based on $50k, not $100k
5. WHEN capital is deployed incrementally (e.g., $10k at start, $30k after 3 months, $50k after 6 months) THEN the system SHALL weight returns by the duration each capital amount was deployed

### Requirement 2: Comprehensive Risk-Adjusted Metrics

**User Story:** As a quantitative trader, I want industry-standard risk-adjusted performance metrics, so that I can evaluate whether my returns justify the risk taken and compare my strategy against benchmarks.

#### Acceptance Criteria

1. WHEN calculating performance THEN the system SHALL compute Sharpe Ratio using (Average Return - Risk-Free Rate) / Standard Deviation of Returns
2. WHEN calculating performance THEN the system SHALL compute Sortino Ratio using only downside volatility in the denominator
3. WHEN calculating performance THEN the system SHALL compute Calmar Ratio as CAGR / Maximum Drawdown
4. WHEN calculating performance THEN the system SHALL compute Maximum Drawdown as the largest peak-to-trough decline
5. WHEN calculating performance THEN the system SHALL compute Average Drawdown and Drawdown Duration
6. WHEN risk-free rate is not specified THEN the system SHALL use a default rate of 4% annually

### Requirement 3: Trading Efficiency Metrics

**User Story:** As a systematic trader, I want detailed metrics about my trading efficiency and win/loss patterns, so that I can identify strengths and weaknesses in my strategy execution.

#### Acceptance Criteria

1. WHEN analyzing trades THEN the system SHALL calculate Win Rate as (Profitable Trades / Total Trades) \* 100
2. WHEN analyzing trades THEN the system SHALL calculate Profit Factor as Gross Profits / Gross Losses
3. WHEN analyzing trades THEN the system SHALL calculate Expectancy as (Win Rate × Average Win) - (Loss Rate × Average Loss)
4. WHEN analyzing trades THEN the system SHALL calculate Average Win Size and Average Loss Size
5. WHEN analyzing trades THEN the system SHALL calculate Average Holding Period for all positions
6. WHEN analyzing trades THEN the system SHALL calculate Profit per Day Held as Total Profit / Sum of (Position Size × Days Held)

### Requirement 4: Opportunity Cost Analysis

**User Story:** As an investor with limited capital, I want to understand the opportunity cost of my capital deployment strategy, so that I can optimize when and how much capital to deploy.

#### Acceptance Criteria

1. WHEN capital is not fully deployed THEN the system SHALL calculate opportunity cost assuming idle capital earns risk-free rate
2. WHEN calculating opportunity cost THEN the system SHALL track daily idle capital amounts
3. WHEN displaying results THEN the system SHALL show opportunity cost adjusted returns
4. WHEN comparing strategies THEN the system SHALL include opportunity cost in total return calculations
5. WHEN idle capital exists THEN the system SHALL calculate what the idle capital could have earned in alternative investments

### Requirement 5: Time-Weighted Performance Analysis

**User Story:** As a portfolio manager, I want time-weighted returns that eliminate the impact of capital deployment timing, so that I can evaluate pure strategy performance independent of when I had capital available.

#### Acceptance Criteria

1. WHEN calculating time-weighted returns THEN the system SHALL break the period into sub-periods based on capital deployment events
2. WHEN capital deployment changes THEN the system SHALL calculate sub-period returns independently
3. WHEN compounding sub-period returns THEN the system SHALL use geometric linking to get total time-weighted return
4. WHEN displaying results THEN the system SHALL show both time-weighted and money-weighted (IRR) returns
5. WHEN comparing multiple strategies THEN the system SHALL use time-weighted returns for fair comparison

### Requirement 6: Benchmark Comparison Metrics

**User Story:** As a trader evaluating strategy effectiveness, I want my performance compared against relevant benchmarks, so that I can determine if my active strategy outperforms passive alternatives.

#### Acceptance Criteria

1. WHEN calculating benchmark comparison THEN the system SHALL compute Alpha as excess return vs benchmark
2. WHEN calculating benchmark comparison THEN the system SHALL compute Beta as correlation to market movements
3. WHEN calculating benchmark comparison THEN the system SHALL compute Information Ratio as (Portfolio Return - Benchmark Return) / Tracking Error
4. WHEN displaying results THEN the system SHALL show outperformance vs Buy & Hold strategy
5. WHEN benchmark data is available THEN the system SHALL calculate correlation coefficients with market indices

### Requirement 7: Performance Metrics UI Integration

**User Story:** As a platform user, I want performance metrics displayed clearly in both individual backtest results and batch optimization tables, so that I can quickly identify the best performing strategies and understand their risk characteristics.

#### Acceptance Criteria

1. WHEN viewing individual backtest results THEN the system SHALL display key metrics in a dedicated performance summary section
2. WHEN viewing batch results table THEN the system SHALL include sortable columns for Sharpe Ratio, Max Drawdown, and Win Rate
3. WHEN displaying metrics THEN the system SHALL use color coding to highlight good vs poor performance (green for good Sharpe Ratio >1, red for high drawdown >20%)
4. WHEN showing detailed results THEN the system SHALL provide expandable sections for advanced metrics
5. WHEN exporting results THEN the system SHALL include all calculated performance metrics in the export data

### Requirement 8: Historical Performance Tracking

**User Story:** As a strategy developer, I want to track performance metrics over different time periods within my backtest, so that I can identify periods of strong or weak performance and understand strategy consistency.

#### Acceptance Criteria

1. WHEN analyzing performance THEN the system SHALL calculate rolling Sharpe Ratios over 252-day periods
2. WHEN analyzing performance THEN the system SHALL identify best and worst performing quarters
3. WHEN analyzing performance THEN the system SHALL calculate year-over-year performance comparisons
4. WHEN displaying results THEN the system SHALL show performance consistency metrics
5. WHEN performance varies significantly by period THEN the system SHALL highlight periods of concern
