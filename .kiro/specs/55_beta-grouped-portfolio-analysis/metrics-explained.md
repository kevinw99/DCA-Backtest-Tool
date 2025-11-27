# Beta-Grouped Portfolio Analysis: Metrics Explained

## Goal: Identify Stocks Most Suitable for DCA Strategy

### Core Question
**"Which beta groups contain stocks where DCA strategy mechanics work most effectively?"**

This is different from asking "Which beta groups had the best returns?" because a stock can have high returns through methods other than DCA (e.g., buy-and-hold on uptrend), while DCA specifically requires:
1. **Volatility**: Creates buy opportunities (price dips trigger grid buys)
2. **Mean Reversion**: Price recovers after dips (buys become profitable)
3. **Capital Efficiency**: Capital is deployed and recycled actively

---

## Metrics Organized by Purpose

### Category 1: Performance Metrics (Standard)
**Purpose**: Measure financial outcomes

| Metric | What It Measures | Why It Matters for DCA |
|--------|------------------|------------------------|
| **Total Return %** | Overall gain/loss as % of deployed capital | Shows if strategy is profitable |
| **Total Return $** | Absolute dollar profit/loss | Shows actual monetary value |
| **CAGR %** | Annualized growth rate | Normalizes return across different time periods |
| **Max Drawdown %** | Largest peak-to-trough decline | Shows worst-case capital loss DCA must recover from |
| **Sharpe Ratio** | Return per unit of total volatility | Standard risk-adjusted performance |
| **Sortino Ratio** | Return per unit of downside volatility | Focuses on harmful volatility (drawdowns) |

**DCA Relevance**: These metrics show "did we make money?" but don't reveal if DCA mechanics were the reason.

---

### Category 2: Trading Effectiveness (How Well DCA Mechanics Work)
**Purpose**: Measure if DCA's core mechanics (averaging down, taking profits) are executing effectively

| Metric | What It Measures | Why It Matters for DCA |
|--------|------------------|------------------------|
| **Win Rate %** | % of trades that are profitable | DCA works best when buys on dips eventually sell at profit |
| **Profit Factor** | Total profit / Total loss | Shows if winning trades outweigh losing trades |
| **Avg Profit per Trade** | Average $ profit on winners | Shows if profit-taking is effective |
| **Avg Loss per Trade** | Average $ loss on losers | Shows impact of stop losses and failed positions |
| **Trade Frequency** | Trades per stock per year | **KEY METRIC**: High frequency = volatility creates opportunities. Low frequency = DCA barely engages. |
| **Mean Reversion Score** | % of buy lots sold at profit (vs stop loss) | **KEY METRIC**: High score = price recovers after dips (DCA works). Low score = price keeps falling (DCA fails). |

**DCA Relevance**:
- **Trade Frequency** reveals if volatility is sufficient for DCA to be active
- **Mean Reversion Score** reveals if "averaging down on dips" actually leads to profitable outcomes

**Example**:
- **High-beta stock (β 2.5)**: 20 trades/year, 45% mean reversion → High activity but poor recovery
- **Market-beta stock (β 1.2)**: 12 trades/year, 72% mean reversion → Moderate activity, excellent recovery
- **Verdict**: Market-beta stock is MORE SUITABLE for DCA despite lower activity

---

### Category 3: Capital Efficiency (How Well Capital Is Utilized)
**Purpose**: Measure if capital is working hard or sitting idle

| Metric | What It Measures | Why It Matters for DCA |
|--------|------------------|------------------------|
| **Avg Capital Utilization %** | Average % of allocated capital deployed | **KEY METRIC**: High utilization = capital actively working. Low = capital sitting idle waiting for opportunities. |
| **Capital Utilization Over Time** | Time-series chart of deployment | **KEY VISUAL**: Shows deployment patterns. Consistent = stable. Spiky = episodic. |
| **Capital Turnover Ratio** | Total traded / Avg deployed capital | **KEY METRIC**: High turnover = capital recycled many times (buy → sell → buy again). Low = capital tied up long-term. |
| **Profit per Day of Deployment** | Total profit / Sum(capital × days) | Measures capital productivity ($ earned per $ deployed per day) |

**DCA Relevance**:
- **Capital Utilization** shows if strategy is actively engaging with the stock
- **Capital Turnover** shows if strategy is recycling capital efficiently (DCA's advantage over buy-and-hold)

**Example**:
- **Low-beta defensive stock (β 0.4)**: 30% avg utilization, 0.8x turnover → Capital mostly idle
- **Market-beta stock (β 1.3)**: 75% avg utilization, 3.2x turnover → Capital working hard, recycling frequently
- **Verdict**: Market-beta stock uses capital FAR more efficiently

---

### Category 4: Strategy Suitability (DCA-Specific Applicability)
**Purpose**: Measure characteristics that make DCA strategy effective vs. ineffective

| Metric | What It Measures | Why It Matters for DCA |
|--------|------------------|------------------------|
| **Grid Utilization Rate %** | Avg lots held / Max lots allowed | **KEY METRIC**: Optimal = 60-80% (actively averaging down but not always maxed out). Too low (<40%) = rarely averages down. Too high (>90%) = always maxed out, no room to buy more dips. |
| **Drawdown Recovery Time** | Avg days from max DD to recovery | **KEY METRIC**: Fast recovery (<60 days) = mean reversion works. Slow (>120 days) = capital tied up too long. |
| **Average Holding Period** | Days between buy and sell | Optimal = weeks/months (DCA timeframe). Too short = noise. Too long = capital efficiency issue. |
| **Opportunity Density** | Trades per $100 price range | Measures if volatility is productive (creates trading opportunities) vs. just noisy |
| **DCA Suitability Score** | Composite 0-100 score | **MASTER METRIC**: Combines all suitability factors into single actionable score |

**DCA Relevance**:
- **Grid Utilization** shows if stock volatility matches DCA's grid spacing
- **Recovery Time** shows if mean reversion happens fast enough to keep capital productive
- **DCA Suitability Score** provides single answer: "Is this stock good for DCA?"

**Example**:
- **Very high-beta volatile stock (β 3.5)**:
  - Grid utilization: 95% (constantly maxed out)
  - Recovery time: 180 days (slow recovery)
  - **Issue**: Too volatile, DCA can't keep up, capital tied up in underwater positions

- **Market-beta balanced stock (β 1.2)**:
  - Grid utilization: 68% (actively averaging down with room for more)
  - Recovery time: 45 days (quick mean reversion)
  - **Ideal**: Volatility matches DCA's capabilities, quick recovery frees capital

---

## How Metrics Answer Key Questions

### Question 1: "Which beta group has the most trading activity?"
**Answer from**: Trade Frequency, Opportunity Density

**Why it matters**: DCA needs volatility to create buy/sell opportunities. Too stable = strategy barely engages.

**Expected pattern**:
- Low-beta (β <0.5): ~4 trades/stock/year (too stable)
- Market-beta (β 1.0-1.5): ~10 trades/stock/year (ideal)
- Very high-beta (β >2): ~18 trades/stock/year (very active but may be too chaotic)

---

### Question 2: "Which beta group recovers best from drawdowns?"
**Answer from**: Mean Reversion Score, Drawdown Recovery Time

**Why it matters**: DCA averages down on dips. If price doesn't recover, those buys become losses.

**Expected pattern**:
- Low-beta (β <0.5): 80% mean reversion, 30-day recovery (strong but infrequent)
- Market-beta (β 1.0-1.5): 68% mean reversion, 50-day recovery (balanced)
- Very high-beta (β >2): 45% mean reversion, 150-day recovery (poor recovery, erratic)

---

### Question 3: "Which beta group uses capital most efficiently?"
**Answer from**: Avg Capital Utilization %, Capital Turnover Ratio, Profit per Day of Deployment

**Why it matters**: DCA's advantage over buy-and-hold is recycling capital. If capital sits idle or is tied up too long, DCA loses its edge.

**Expected pattern**:
- Low-beta (β <0.5): 35% utilization, 1.2x turnover (mostly idle)
- Market-beta (β 1.0-1.5): 70% utilization, 3.0x turnover (high efficiency)
- Very high-beta (β >2): 85% utilization, 1.5x turnover (deployed but stuck in positions)

---

### Question 4: "Which beta group is MOST SUITABLE for DCA strategy?"
**Answer from**: DCA Suitability Score (composite of all factors)

**Formula**:
```
DCA Suitability Score =
  Trade Activity Score (0-25) +
  Mean Reversion Score (0-25) +
  Capital Efficiency Score (0-25) +
  Grid Utilization Score (0-25)
= Total (0-100)
```

**Expected ranking**:
1. **Market-beta (β 1.0-1.5)**: Score ~75-85 (balanced volatility + strong mean reversion + efficient capital use)
2. **High-beta (β 1.5-2.0)**: Score ~65-75 (high activity but slower recovery)
3. **Below-market (β 0.5-1.0)**: Score ~55-65 (stable with good reversion but low activity)
4. **Low-beta (β <0.5)**: Score ~35-45 (too stable, DCA barely engages)
5. **Very high-beta (β >2)**: Score ~40-50 (too chaotic, poor mean reversion)

---

## Metrics That Directly Answer Your Request

### Your Request: "Capital utilization over time"
**Provided by**:
- **Average Capital Utilization %**: Single number showing avg % deployed
- **Capital Utilization Over Time Chart**: Time-series visualization showing deployment trends per beta group

**What it reveals**: Which beta groups keep capital actively deployed vs. sitting idle

---

### Your Request: "Trade frequency over time"
**Provided by**:
- **Trade Frequency**: Trades per stock per year per beta group
- **Opportunity Density**: Trades per $100 price range (normalizes for price level)

**What it reveals**: Which beta groups create enough volatility for DCA to engage frequently

---

### Your Request: "Metrics that reflect DCA strategy applicability/sensitivity"
**Provided by**:
1. **Mean Reversion Score**: Does price recover after you buy the dip? (DCA's core mechanic)
2. **Grid Utilization Rate**: Does volatility match your grid spacing? (DCA's scaling mechanic)
3. **Drawdown Recovery Time**: How fast does mean reversion happen? (Capital efficiency)
4. **Capital Turnover Ratio**: How many times is capital recycled? (DCA's advantage over buy-and-hold)
5. **DCA Suitability Score**: Master metric combining all factors

**What it reveals**: Which stocks/beta groups are structurally suited to DCA's mechanics, not just which happened to perform well

---

## Example Use Case

### Scenario: Comparing Two Beta Groups

**Group A: Market-Beta (β 1.0-1.5, 50 stocks)**
- Total Return: 32%
- Trade Frequency: 11 trades/stock/year
- Mean Reversion Score: 68%
- Avg Capital Utilization: 72%
- Capital Turnover: 3.2x
- Grid Utilization: 65%
- Recovery Time: 48 days
- **DCA Suitability Score: 82/100**

**Group B: Very High-Beta (β >2, 6 stocks)**
- Total Return: 45%
- Trade Frequency: 19 trades/stock/year
- Mean Reversion Score: 42%
- Avg Capital Utilization: 88%
- Capital Turnover: 1.4x
- Grid Utilization: 92%
- Recovery Time: 165 days
- **DCA Suitability Score: 48/100**

### Analysis:
- **Group B has higher returns (45% vs 32%)** ← Traditional performance metric
- **But Group A is FAR more suitable for DCA (82 vs 48)** ← Strategy suitability metric

**Why?**
- Group B's high returns may be from lucky buy-and-hold timing, not DCA mechanics
- Group B has poor mean reversion (only 42% of buys eventually profit)
- Group B ties up capital for long periods (165 days to recover from drawdowns)
- Group A consistently creates opportunities, recovers quickly, recycles capital efficiently

**Conclusion**: For a portfolio focused on DCA strategy, **select more stocks from Group A**, even though Group B had higher historical returns. Group A stocks are structurally better fits for DCA.

---

## Summary: How to Use These Metrics

### Step 1: Identify Best Performing Beta Groups
**Use**: Total Return %, CAGR, Sharpe Ratio

**Question**: "Which beta groups made the most money?"

---

### Step 2: Identify Most DCA-Suitable Beta Groups
**Use**: DCA Suitability Score, Trade Frequency, Mean Reversion Score, Capital Utilization

**Question**: "Which beta groups are best suited to DCA strategy mechanics?"

---

### Step 3: Find the Overlap
**Question**: "Which beta groups are BOTH profitable AND well-suited to DCA?"

**This is the sweet spot**: Stocks that perform well AND do so through DCA-friendly patterns (volatility + mean reversion + efficient capital use)

---

### Step 4: Stock Selection
**Within the best beta group(s)**:
- Sort stocks by DCA Suitability Score
- Select top 20-30 stocks with highest scores
- These are stocks where DCA strategy will be most effective

**Result**: A portfolio optimized not just for returns, but for returns *generated by DCA strategy*, which is more sustainable and predictable.
