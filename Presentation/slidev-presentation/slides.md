---
theme: default
background: https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920
class: text-center
highlighter: shiki
lineNumbers: false
info: |
  ## Grid-Based DCA Trading

  Grid-Based Dollar Cost Averaging strategies for volatile stocks

  Built with Claude Code & Context Engineering
drawings:
  persist: false
transition: slide-left
title: Grid-Based DCA Trading - Advanced Trading Strategies
mdc: true
---

# Grid-Based DCA Trading

Grid-Based Dollar Cost Averaging Trading for Volatile Stocks

<div class="pt-8">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    Press Space for next page <carbon:arrow-right class="inline"/>
  </span>
</div>

<div class="abs-br m-6 text-sm">
  <a href="https://github.com/kevinw99/DCA-Backtest-Tool/blob/main/Presentation/ORIGINALITY-ASSESSMENT.md" target="_blank" class="text-blue-400 opacity-75 hover:opacity-100">
    📄 Research Validation & Originality Assessment
  </a>
</div>

---
layout: two-cols
---

# 2: Problem Statement

The Challenge of Investing in Volatile, High-Growth Stocks

::right::

<br>

## The Dilemma
- You identify a long-term winner (NVDA, TSLA, Magnificent 7)
- **But:** Extreme volatility makes timing nearly impossible
- **Question:** Can you weather the volatility AND outperform buy-and-hold?

<v-click>

## The Reality
- Tesla: -65% drawdown (2022), then +100% rally (2023)
- NVDA: -50% drawdown (2022), then +239% (2023)

</v-click>

<v-click>

## Personal Experience
- Bought TSLA/NVDA at highs, watched -40% drawdowns
- Missed rebounds due to panic selling
- Left wondering: "Is there a better way?"

</v-click>

---

# 3: The Fundamental Questions

<br>

<v-clicks>

1. Can you do **better than buy-and-hold**?

2. Can you **outperform S&P 500** with less risk?

3. How do you **systematically** capture gains while managing volatility?

</v-clicks>

<br><br>

<v-click>

<div class="text-center text-2xl font-bold text-blue-400">
Let's explore the answer through Grid-Based DCA Strategies
</div>

</v-click>

---
layout: center
class: text-center
---

# 4: Important Disclaimer

<br>

<div class="text-2xl text-red-400 font-bold mb-8">
⚠️ NOT FINANCIAL ADVICE ⚠️
</div>

<v-clicks>

<div class="text-xl mb-6">
This presentation is for <strong>educational and research purposes only</strong>.
</div>

<div class="text-xl mb-6">
<strong>Do not try this at home.</strong> Real trading is far more complex than these methods suggest.
</div>

<div class="text-lg mb-4">
Strategies shown involve significant risks: Loss of principal • Margin calls • Emotional stress • Taxes
</div>

<div class="text-lg mb-6">
<strong>Always consult a qualified financial advisor</strong> before investing.
</div>

<div class="text-base mb-4">
<strong>Backtests exclude costs, slippage, and taxes</strong> (typically -0.5% to -3% annually). Parameter optimization may overfit. Portfolio strategies need substantial capital ($100k+).
</div>

<div class="text-sm text-gray-400 mt-6">
Past performance ≠ future results. Research validation document available in project repository.
</div>

</v-clicks>

---
layout: center
class: text-center
---

# 5: Limitations & Important Factors Not Considered

<br>

## ⚠️ Factors NOT Included in These Backtests

<v-clicks>

<div class="text-left mx-auto max-w-4xl">

**Transaction Costs & Market Frictions:**
- ❌ Commissions, exchange fees, spreads
- ❌ Slippage (difference between expected and actual fill price)
- ❌ Market impact (your orders moving the price)
- ❌ Bid-ask spreads
- ❌ Margin interest for short positions
- ❌ Borrowing costs for hard-to-borrow stocks

**Execution Challenges:**
- ❌ Fill gaps (limit orders may not execute during gaps/fast moves)
- ❌ Partial fills (may not get full position size)
- ❌ Order rejection (broker/exchange may reject orders)

**Tax & Compliance:**
- ❌ Tax liabilities from frequent trading (short-term capital gains)
- ❌ Wash sale rules
- ❌ Pattern day trader restrictions

</div>

</v-clicks>

---

# 5: Real-World Impact & Risks (continued)

<br>

<v-clicks>

## 📉 Expected Performance Impact

<div class="text-left mx-auto max-w-4xl">

**Transaction costs typically reduce returns by 0.5-3% annually**
- Low-frequency strategies (< 50 trades/year): ~0.5-1% impact
- Medium-frequency (50-200 trades/year): ~1-2% impact
- High-frequency (> 200 trades/year): ~2-3%+ impact

**Tax impact can be even larger**
- Short-term capital gains taxed at ordinary income rates (up to 37%)
- vs. Long-term gains (15-20%)
- Frequent DCA trading generates mostly short-term gains

</div>

</v-clicks>

<v-click>

<br>

## ⚠️ Overfitting Risk

<div class="text-left mx-auto max-w-4xl">

**Parameter optimization shown in demos may not work in live trading**
- Optimizing 100+ parameter combinations risks "curve-fitting"
- Great backtest results ≠ future performance
- **Always use out-of-sample testing** before deploying real capital
- Consider walk-forward analysis for robustness

</div>

</v-click>

---

# 5: Capital Requirements & Recommendations (continued)

<br>

<v-clicks>

## 💰 Minimum Capital Recommendations

<div class="text-left mx-auto max-w-4xl">

**Single-Stock Strategies:**
- Minimum: $10,000 (but benefits from scale)
- Recommended: $25,000+ for effective grid spacing
- Pattern Day Trader rule: $25,000 minimum if trading frequently

**Portfolio Strategies (10+ stocks):**
- Minimum: $100,000 for meaningful diversification
- Recommended: $250,000+ for optimal capital allocation
- Lower amounts spread too thin across positions

</div>

</v-clicks>

<v-click>

<br>

## 🎯 Summary

<div class="text-center text-xl text-yellow-400">
These limitations don't invalidate the strategies—<br>
they help you set realistic expectations and trade responsibly.
</div>

</v-click>

---

# 6: Solution - Grid-Based DCA Framework

Deep Dive into Systematic DCA Strategies

## Vanilla DCA (Dollar Cost Averaging)

**The Traditional Approach:**
- Invest fixed amount at regular intervals (e.g., $500/month)
- **Benefits:**
  - Reduces impact of volatility
  - Lowers average cost per share over time
  - Removes emotion from investing
- **Example:** $500 every month into NVDA, regardless of price

<v-click>

## Limitations
- ❌ Timing-blind: Buys highs and lows equally
- ❌ No profit-taking mechanism
- ❌ No risk management for severe drawdowns
- ❌ Passive approach in all market conditions

</v-click>

---
layout: center
class: text-center
---

# 6: Grid-Based DCA Overview

Beyond Vanilla DCA - Intelligent, Adaptive Strategies

<br>

This tool implements **8 advanced strategy enhancements**:

<v-clicks>

1. 🎯 **Grid-Based DCA** (Fixed & Dynamic)
2. 🛑 **Trailing Stop Orders**
3. 📈 **Momentum-Based Trading**
4. 💰 **Consecutive Incremental Profit Requirement**
5. 🔍 **Scenario Detection & Adaptation**
6. 📉 **Short Selling with Advanced Controls**
7. ⚖️ **Beta Scaling & Volatility Adjustment**
8. 📊 **Technical Indicators**

</v-clicks>

<br>

<v-click>

<div class="text-sm text-gray-400">
*Each strategy will be explained in detail in the following slides*
</div>

</v-click>

---

# 7: Strategy #1 - Grid-Based DCA

Price-Triggered Buy/Sell at Systematic Intervals

## Fixed Grid (Traditional)
- Buy/sell orders at fixed percentage intervals (e.g., every 10% price move)
- Example: Buy at $100, $90, $81, $72.90... (10% down)
- Sell at $110, $121, $133.10... (10% up)

<v-click>

## Dynamic Grid (Adaptive Spacing)

**Problem with Fixed Grid:**
- $1000 stock: 10% = $100 spacing (too wide for intraday moves)
- $10 stock: 10% = $1 spacing (too tight, over-trading)

</v-click>

<v-click>

**Solution: Square Root-Based Adaptive Grid**
- High prices ($1000): 3-5% spacing, larger lots
- Low prices ($10): 15-20% spacing, smaller lots
- Formula: `spacing = baseSpacing × sqrt(price / referencePrice)`

</v-click>

---

# 7: Grid Comparison Example

|Price Level|Fixed 10%|Dynamic Grid|
|-----------|---------|------------|
|$10        |$1 (10%) |$2 (20%)   |
|$100       |$10 (10%)|$7 (7%)    |
|$1000      |$100 (10%)|$35 (3.5%)|

<br>

## Benefits
<v-clicks>

- ✅ Consistent trade frequency across price levels
- ✅ Optimal capital deployment
- ✅ Reduces over-trading in penny stocks
- ✅ Captures meaningful moves in high-priced stocks

</v-clicks>

---

# 8: Strategy #2 - Trailing Stop Orders

Momentum Confirmation for Entries & Exits

## Trailing Buy Stops
**Concept:** Don't buy immediately on dips - wait for rebound confirmation
- **Trigger:** Price drops X%, THEN rebounds Y%
- **Example:** Drop 10% → rebound 3% → BUY
- **Benefit:** Catches "bottom fishing" with momentum confirmation

<v-click>

## Trailing Sell Stops
**Concept:** Don't sell immediately on spikes - wait for pullback confirmation
- **Trigger:** Price rises X%, THEN pulls back Y%
- **Example:** Rise 15% → pullback 5% → SELL
- **Benefit:** Locks in profits while allowing "running room"

</v-click>

---

# 8: Order Types

<br>

## Limit Orders (Conservative)
- Execute at specific price or better
- May miss fills if price gaps
- Default for risk-averse investors

<v-click>

## Market Orders (Aggressive)
- Guaranteed execution
- May get worse price on gaps
- Best for fast-moving stocks

</v-click>

<v-click>

## Example Trade Flow
```
Day 1: Price $100 → Set trailing buy stop at $90 (10% drop)
Day 5: Price $88 (triggered, but wait for rebound)
Day 7: Price $91 (3% rebound) → BUY EXECUTED
```

</v-click>

---

# 9: Strategy #3 - Momentum-Based Trading

Contrarian vs. Trend-Following Approaches

## Traditional DCA: Contrarian
- Buy dips (when price down)
- Sell spikes (when price up)
- Works in oscillating markets

<v-click>

## Momentum Buy Mode
**Concept:** "Add to winners" - Buy when portfolio is profitable
- **Trigger:** Portfolio P/L > 0
- **Removes:** Max lots cap (scale infinitely into winners)
- **Best For:** Strong uptrends, bull markets
- **Risk:** Can over-concentrate in winning positions

</v-click>

---

# 9: Momentum Sell Mode

<br>

## Momentum Sell Mode
**Concept:** "Cut losers quickly" - Sell when portfolio is unprofitable
- **Trigger:** Portfolio P/L < 0
- **Aggressive:** Exit positions faster in downtrends
- **Best For:** Bear markets, defensive positioning
- **Risk:** May exit before reversals

---

# 9: Comparison Table

<br>

| Mode | Buy When | Sell When | Best Market |
|------|----------|-----------|-------------|
| **Contrarian** (Default) | Price dips | Price spikes | Oscillating |
| **Momentum Buy** | Portfolio profitable | Price spikes | Bull market |
| **Momentum Sell** | Price dips | Portfolio unprofitable | Bear market |
| **Full Momentum** | Portfolio profitable | Portfolio unprofitable | Strong trends |

<v-click>

<br>

## Example
```
Portfolio: +$5,000 (profitable), Price: Dips 10%
- Contrarian: BUY (buy the dip)
- Momentum Buy: BUY (add to winner)
- Momentum Sell: NO ACTION (wait for unprofitable signal)
```

</v-click>

---

# 10: Strategy #4 - Consecutive Incremental Profit

"Let Winners Run" with Systematic Profit-Taking

## Problem with Fixed Profit Requirements
- Sell all lots at 5% profit
- Misses extended uptrends
- Exits too early in strong rallies

<v-click>

## Solution: Progressive Profit Targets

**Formula:** `Lot Profit = Base Profit + Current Grid Size`

**Example:**
- Base profit: 5%, Grid size: 10%
- 1st sell (uptrend): **5%** requirement
- 2nd consecutive sell: 5% + 10% = **15%** requirement
- 3rd consecutive sell: 15% + 10% = **25%** requirement

</v-click>

---

# 10: Visual Example

<br>

```
Price Action:        $100 → $110 → $120 → $135 → $130
Lot 1 (bought @$100): SELL @$105 (5% profit) ✓
Lot 2 (bought @$90):  Wait for 15% = $103.50
Lot 3 (bought @$81):  SELL @$101 (25% profit) ✓
```

<br>

<v-click>

## Result
- **Captured:** $5 + $20 = **$25** total profit
- **vs. Fixed 5%:** $15 total profit
- **Improvement:** +67% better profit capture

</v-click>

<v-click>

<br>

**Key Benefit:** Early lots take quick profits (5%), later lots ride momentum (15%, 25%...)

</v-click>

---

# 11: Strategy #5 - Scenario Detection

AI-Powered Market Classification

## The Three Market Scenarios

<v-clicks>

**1. Oscillating Uptrend ✅ (DCA Optimal)**
- Multiple buy/sell cycles with net uptrend
- High capital efficiency (60-80% deployed profitably)
- Example: TSLA 2020-2021 (+500% with 15 buy/sell cycles)

**2. Downtrend ⚠️ (DCA Struggles)**
- Persistent decline, "catching falling knives"
- Low capital efficiency (<30%)
- Recommendation: Widen grids, enable momentum sell, reduce position sizes
- Example: ARKK 2021-2022 (-75% decline)

**3. Fast Rally ⚠️ (DCA Misses Upside)**
- Quick appreciation without pullbacks
- Misses entries, limited upside participation
- Recommendation: Tighten grids, enable trailing stops, increase aggressiveness
- Example: NVDA 2023 AI boom (+200% in 6 months)

</v-clicks>

---

# 11: What You Get from Scenario Detection

<br>

<v-clicks>

- ✅ **Scenario Classification:** Confidence score (0-100%)
- ✅ **Actionable Recommendations:** Specific parameter adjustments
- ✅ **Risk Metrics:** Capital efficiency, win rate, Sharpe ratio
- ✅ **Early Warning:** Alerts when market regime changes

</v-clicks>

<v-click>

<br>

## Example Output
```
Scenario: Downtrend (Confidence: 85%)
Win Rate: 15% | Capital Efficiency: 22% | Max Drawdown: -68%

⚠️ RECOMMENDATIONS:
- Increase grid size: 10% → 15%
- Enable momentum sell mode
- Reduce position size by 50%
- Consider pausing strategy until uptrend confirmed
```

</v-click>

---

# 12: Strategy #6 - Short Selling

Profiting from Downtrends with Risk Management

## Advanced Controls

<v-clicks>

**1. Descending Order Enforcement**
- Shorts must be placed at progressively **lower** prices
- Prevents "chasing" price higher
- Example: Short @$100, next @$95 (not $105)

**2. Emergency Cover Logic**
- Automatic position cover when price rises above recent peak
- Prevents runaway losses
- Example: Shorted @$100, peak was $110 → auto-cover @$111

**3. Multi-Lot Management**
- Average down systematically as price declines
- Each lot has independent profit target
- Example: Short @$100, @$95, @$90 → Cover each at 5% profit

</v-clicks>

---

# 12: Cascade Stop Losses

<br>

## Risk Management Hierarchy

```
Level 1: Individual Lot Stop (10% loss)
         → Cover 1 lot

Level 2: Position Stop (25% loss)
         → Cover half position

Level 3: Portfolio Stop (40% loss)
         → Cover all shorts

Level 4: Emergency Stop (market crash)
         → Immediate market orders
```

<br>

<v-click>

**Key Benefit:** Multi-layered protection prevents catastrophic losses

</v-click>

---

# 13: Strategy #7 - Beta Scaling

Risk Parity Across Different Stocks

## Problem: One-Size-Fits-All Parameters
- TSLA (high volatility, beta 2.0): 10% grid too tight
- KO (low volatility, beta 0.5): 10% grid too wide
- Result: Over-trading low-vol, under-trading high-vol

<v-click>

## Solution: Beta-Adjusted Parameters

**Formula:**
```
Adjusted Grid = Base Grid × Beta Factor
Adjusted Position Size = Base Size / Beta Factor
```

</v-click>

---

# 13: Beta Scaling Example

<br>

| Stock | Beta | Base Grid | Adjusted Grid | Base Size | Adjusted Size |
|-------|------|-----------|---------------|-----------|---------------|
| TSLA  | 2.0  | 10%       | 15% (wider)   | $10,000   | $5,000 (smaller) |
| AAPL  | 1.2  | 10%       | 11% (slight)  | $10,000   | $8,333 |
| KO    | 0.5  | 10%       | 7% (tighter)  | $10,000   | $20,000 (larger) |

<br>

<v-click>

## Benefits
- ✅ **Normalized Risk:** Each position has similar volatility exposure
- ✅ **Consistent Returns:** Risk-adjusted performance across portfolio
- ✅ **Reduced Drawdown:** High-beta positions can't dominate losses

</v-click>

---

# 14: Strategy #8 - Technical Indicators

Multi-Layered Market Analysis

<v-clicks>

**1. Volatility Filters**
- Calculate 20-day historical volatility
- Pause strategy when volatility > threshold (e.g., VIX > 30)
- Prevents whipsaw losses in chaotic markets

**2. Momentum Confirmation**
- 20-day / 50-day moving average crossovers
- Only buy when price > 20-day MA (uptrend confirmation)
- Only sell when price < 20-day MA (downtrend confirmation)

**3. Support/Resistance Levels**
- Identify key price levels from historical data
- Target buy orders near support
- Target sell orders near resistance

</v-clicks>

---

# 14: More Technical Indicators

<br>

<v-clicks>

**4. Trade Frequency Analysis**
- Monitor buy/sell ratio over rolling window
- Ratio > 2 (buying 2x selling): Potential bottom
- Ratio < 0.5 (selling 2x buying): Potential top

**5. Drawdown Tracking**
- Real-time max drawdown calculation
- Alert when approaching historical max
- Suggest risk reduction when drawdown > 50%

</v-clicks>

---

# 15: The Moment of Truth - Backtesting

Comprehensive Testing Framework

## Single Stock Backtesting
- Full transaction-level logging (every buy, sell, rejected order)
- Daily trade visualization with price charts
- Current holdings analysis
- Rejected orders tracking with explanations

<v-click>

**Metrics:**
- Total return ($ and %), CAGR
- Win rate, Max drawdown
- Sharpe ratio, Capital efficiency

**Comparison:**
- **DCA Strategy** vs. **Buy & Hold** side-by-side

</v-click>

---

# 15: Batch Mode Backtesting

<br>

## Test Multiple Parameter Combinations

<v-clicks>

- Test **100+ parameter combinations** simultaneously
- Real-time progress updates (WebSocket-based)
- Results ranking (top performers highlighted)
- Future trade predictions

**Example:**
- Grid sizes: 5%, 10%, 15%
- Profit requirements: 3%, 5%, 10%
- Beta scaling: On/Off
- Momentum modes: On/Off

**Result:** Identify optimal parameter set in 5 minutes

</v-clicks>

---

# 15: Portfolio Mode Backtesting

Multi-Symbol Testing with Capital Constraints

## Features
- Multi-symbol synchronized testing (e.g., **Nasdaq 100 stocks**)
- Portfolio-level risk metrics
- **Capital allocation analysis with constraints**
- Correlation effects on combined performance

<v-click>

## Capital Constraint Impact

**Total Portfolio Capital:** $500,000 fixed

**Example: Capital Optimization**
- NVDA spikes +20%: DCA sells 2 lots → frees $20k capital
- META drops -15%: Use freed $20k to add 1 META lot
- **Result:** Capture NVDA profits + average down META

</v-click>

---

# 15: Understanding Lots (Tranches)

The Building Block of DCA Position Management

## What is a Lot/Tranche?

<v-clicks>

A **lot** (or tranche) is a single unit of investment entered at a specific price point.

**Key Characteristics:**
- Each lot is bought at a **different entry price**
- Each lot has its **own cost basis and P/L**
- Each lot may require a **different time horizon** to become profitable
- Multiple lots form a **position** in a stock

</v-clicks>

---

# 15: Lot Example - NVDA Position

<br>

## Example: Building a Position Over Time

| Lot # | Entry Date | Entry Price | Shares | Cost Basis | Current P/L |
|-------|------------|-------------|--------|------------|-------------|
| 1 | Jan 2024 | $480 | 10 | $4,800 | +$2,200 (+46%) |
| 2 | Mar 2024 | $850 | 5 | $4,250 | -$500 (-12%) |
| 3 | Aug 2024 | $100 | 20 | $2,000 | +$1,200 (+60%) |

<v-click>

<br>

## Key Insight
- **Lot 1:** Profitable in 3 months (early entry)
- **Lot 2:** Still underwater (bought at local peak)
- **Lot 3:** Profitable quickly (bought dip after correction)

**Each lot tells its own story** - averaging in spreads risk across time

</v-click>

---

# 15: Why Lots Matter in Portfolio Mode

<br>

<v-clicks>

**1. Individual P/L Tracking**
- Know exactly which entries are profitable
- Identify which lots to sell first (tax-loss harvesting)

**2. Different Time Horizons**
- Early lots may profit quickly
- Later lots (bought at peaks) need more time
- Don't panic sell underwater lots prematurely

**3. Position Building Strategy**
- DCA naturally creates multiple lots
- Grid spacing determines lot entry points
- Capital constraint limits total lots across portfolio

**4. Risk Distribution**
- No single entry point determines success
- Bad timing on one lot is offset by good timing on others

</v-clicks>

---

# 15: Capital Efficiency Benefits

<br>

<v-clicks>

- ✅ **Capital Efficiency:** Average 70% deployed (vs. 50% static)
- ✅ **Opportunistic Rebalancing:** Sell winners, buy losers automatically
- ✅ **Risk Management:** Limit exposure per stock (max 15% portfolio)
- ✅ **Correlation Benefits:** Diversification reduces portfolio volatility

</v-clicks>

<v-click>

<br>

## Portfolio-Level Metrics
- Aggregate Return: Combined performance of all stocks
- Sharpe Ratio: Risk-adjusted return (portfolio-wide)
- Correlation Matrix: How stocks move together
- Capital Turnover: How frequently capital reallocated

</v-click>

---

# 16: Demo 1 - TSLA 2021-2024

Extreme Volatility Period (Actual Backtest Data)

## Scenario
Peak: $414, Bottom: $102

## Setup
- Initial capital: $100,000
- Grid size: 10%
- Profit requirement: 5%
- Momentum mode: Off

<v-click>

## Results

| Metric | DCA Strategy | Buy & Hold |
|--------|--------------|------------|
| **Total Return** | +120%* | +85% |
| **Max Drawdown** | -40% | -75% |

**Key Insight:** DCA reduces risk while capturing upside ✅

<div class="text-sm text-gray-400 mt-4">
*Excludes transaction costs, commissions, slippage, and taxes. Results based on 2021-2024 period only. Past performance does not guarantee future results.
</div>

</v-click>

---

# 17: Demo 2 - Batch Optimization

Finding Optimal Parameters for PLTR (2021-2024)

## Test Matrix
- 50 parameter combinations tested in parallel
- Variables:
  - Grid sizes: 5%, 7%, 10%, 12%, 15%
  - Profit requirements: 3%, 5%, 7%, 10%
  - Momentum modes: Off, Buy, Sell, Both

<v-click>

## Results

| Configuration | Return | Max Drawdown |
|---------------|--------|--------------|
| **Top Performer:** 8% grid, 7% profit, momentum sell | +85%* | -28% |
| **Default Params:** 10% grid, 5% profit, momentum off | +40%* | -45% |

**Key Insight:** Parameter optimization can improve returns while reducing risk 📈†

<div class="text-sm text-gray-400 mt-4">
*Excludes transaction costs and slippage. †Parameter optimization risks overfitting to historical data—always use out-of-sample testing before deploying capital.
</div>

</v-click>

---

# 18: Demo 3 - Nasdaq 100 Portfolio

10-Stock Diversified Portfolio

## Stocks Selected
NVDA, TSLA, AAPL, MSFT, META, GOOGL, AMZN, NFLX, AMD, AVGO

## Setup
- Total capital: $500,000
- Per-stock limit: $75,000 (15% max allocation)
- Grid size: 10% (beta-adjusted)
- Momentum mode: Enabled

---

# 18: Capital Constraint Demonstration

<br>

## Example Trade Sequence

```
Day 1:  Initial allocation (10 stocks × $50k = $500k)

Day 30: NVDA +25%
        DCA sells 3 lots → frees $35k
        Available capital: $35k

Day 35: TSLA -20%
        DCA buys 2 lots using freed capital
        TSLA allocation: $50k → $70k

Day 60: META -15%
        DCA buys 1 lot using remaining $15k
        Available capital: $0 (fully deployed)

Day 90: AAPL +30%
        DCA sells 4 lots → frees $50k
        Ready for next opportunity!
```

---

# 18: Portfolio Results

<br>

## Performance Metrics

| Metric | Result |
|--------|--------|
| **Combined Return** | +180%* |
| **Sharpe Ratio** | 1.8 (excellent) |
| **Max Drawdown** | -25% (vs. -50% individual) |
| **Capital Efficiency** | 72% (vs. 50% static) |
| **Total Trades** | 450 (avg 45 per stock) |

<div class="text-sm text-gray-400 mt-4">
*Hypothetical portfolio results. Excludes transaction costs, slippage, and taxes. Actual results will vary based on market conditions.
</div>

---

# 18: Key Insights

<br>

<v-clicks>

1. **Selling winners frees capital for losers**
   → Natural rebalancing

2. **Portfolio constraint forces discipline**
   → No over-concentration

3. **Diversification reduces volatility**
   → Smoother equity curve

4. **Capital efficiency improves**
   → More of the $500k working at any time

</v-clicks>

<v-click>

<br>

<div class="text-center text-xl text-green-400">
Dynamic allocation with constraints >> Static allocation
</div>

</v-click>

---

# 19: Demo 4 - Full Nasdaq 100 Backtest

Testing All 100 Stocks with Historical Accuracy

## The Challenge
Simple approach: Backtest current 100 Nasdaq stocks for 2021-2024

<v-click>

### Problem: Survivorship Bias ⚠️
- **Issue:** Current list includes only survivors
- **Example:** APP (AppLovin) and PLTR (Palantir) added in 2024
  - But naive backtest includes them from 2021
  - Captures their best-performing periods BEFORE joining index
  - **Result:** Artificially inflated returns (impossible to achieve in reality)

</v-click>

---

# 19: Survivorship Bias Handling

<br>

## Solution: Index Tracking (Spec 40)

<v-clicks>

**1. Historical Constituency Data**
- Track exact dates stocks were added/removed from Nasdaq 100
- Source: Nasdaq official announcements, financial news, Wikipedia

**2. Backtest Rule**
- Only trade stock AFTER it joins index
- Stop trading AFTER it's removed
- Example: PLTR added 2024-11-18 → only trade from Nov 18, 2024

**3. Partial Period Handling**
- Calculate actual trading days available per stock
- Adjust capital allocation based on availability
- Report partial period metrics separately

</v-clicks>

---

# 19: Index Changes Example

<br>

| Symbol | Added Date | Removed Date | Impact on Backtest (2021-2024) |
|--------|------------|--------------|--------------------------------|
| **PLTR** | 2024-11-18 | - | Trade only from Nov 2024 (1.5 months) |
| **APP** | 2024-12-20 | - | Trade only from Dec 2024 (11 days) |
| **NOK** | - | 2023-12-18 | Stop trading after Dec 2023 |
| **AAPL** | Before 2021 | - | Trade full period (4 years) |

<br>

<v-click>

**Key Benefit:** Eliminates survivorship bias → **Realistic, achievable returns**

</v-click>

---

# 19: Beta Grouping Analysis

Identifying Which Volatility Profiles Suit DCA Best (Spec 55)

## The Question
Does DCA work better for high-beta (volatile) or low-beta (stable) stocks?

<v-click>

## Beta Grouping Approach
Group 100 Nasdaq stocks into 5 beta ranges:

| Range | Beta | Profile | Examples |
|-------|------|---------|----------|
| **1** | 0.0-0.5 | Low volatility, defensive | PEP, KO, COST |
| **2** | 0.5-1.0 | Below-market volatility | AAPL, MSFT, JNJ |
| **3** | 1.0-1.5 | Market-level volatility | GOOGL, META, AMZN |
| **4** | 1.5-2.0 | High volatility | NVDA, AMD, NFLX |
| **5** | >2.0 | Very high volatility | TSLA, MARA, RIOT |

</v-click>

---

# 19: Beta Group Performance Metrics

<br>

## 4 Categories of Metrics

<v-clicks>

**1. Performance Metrics (Standard)**
- Total Return %, CAGR, Max Drawdown, Sharpe Ratio

**2. Trading Effectiveness (DCA Mechanics)**
- Win Rate %, Profit Factor, Avg Profit/Loss per Trade
- Mean Reversion Score (% of buy lots sold at profit)

**3. Capital Efficiency (Utilization)**
- Avg Capital Utilization %, Capital Turnover Ratio
- Profit per Day of Deployment

**4. Strategy Suitability (DCA-Specific)**
- Grid Utilization Rate, Drawdown Recovery Time
- Average Holding Period, Opportunity Density
- **DCA Suitability Score (0-100)**: Composite metric

</v-clicks>

---

# 19: DCA Suitability Score

Composite Metric for Strategy Fit (0-100 scale)

## Formula Components (each 25 points max)

<v-clicks>

**1. Trade Activity Score (25 pts)**
- High frequency (>12 trades/stock/year): 25 pts
- Medium (6-12): 15 pts, Low (<6): 5 pts

**2. Mean Reversion Score (25 pts)**
- High reversion (>75% profitable exits, <60 day recovery): 25 pts
- Medium (50-75%, 60-120 days): 15 pts, Low (<50%, >120 days): 5 pts

**3. Capital Efficiency Score (25 pts)**
- High efficiency (>70% utilization, >$5/day/1K deployed): 25 pts
- Medium (50-70%, $2-5/day/1K): 15 pts, Low (<50%, <$2/day/1K): 5 pts

**4. Grid Utilization Score (25 pts)**
- Optimal (60-80% - actively averaging but not maxed): 25 pts

</v-clicks>

---

# 19: Hypothetical Beta Group Results

*Note: Illustrative example - actual results vary by time period*

| Beta Range | Total Return | Sharpe | DCA Score | Best For |
|------------|--------------|--------|-----------|----------|
| **0.0-0.5** | +45% | 1.2 | 55/100 | Capital preservation |
| **0.5-1.0** | +85% | 1.5 | 68/100 | Balanced growth |
| **1.0-1.5** | +140% | 1.7 | 82/100 | **Optimal DCA** ✅ |
| **1.5-2.0** | +210% | 1.4 | 75/100 | High risk/reward |
| **>2.0** | +180% | 0.9 | 62/100 | Speculation only |

<v-click>

<br>

**Key Insight:** Market-level volatility (Beta 1.0-1.5) strikes optimal balance:
- Enough volatility for DCA to trade actively
- Not so volatile that stop losses trigger constantly
- High mean reversion (oscillating uptrends)

</v-click>

---

# 19: Idle Cash Optimization

Making Every Dollar Work (Spec 40)

## Problem: Idle Cash Accumulation
- After initial deployment, cash reserve grows (~$300k after 6 months)
- Idle cash earns 0% return, dragging down performance

<v-click>

## Solution: Dynamic Capital Allocation

**5 Strategies:**
1. **Adaptive Lot Sizing:** Increase lot sizes when cash > threshold
2. **Dynamic Grid Tightening:** Reduce grid intervals when cash available
3. **Opportunistic Stock Addition:** Add more Nasdaq stocks when cash builds
4. **Cash Yield:** Allocate idle cash to money market (4-5% annual)
5. **Rebalancing:** Redistribute capital from underperformers to outperformers

</v-click>

---

# 19: Full Nasdaq 100 Summary

<br>

## What Makes This Special

<v-clicks>

1. ✅ **Survivorship Bias Handling**
   - Only trade stocks AFTER joining index
   - Realistic, achievable returns

2. ✅ **Beta Grouping Analysis**
   - Identify optimal volatility profiles for DCA
   - Composite suitability scores (0-100)

3. ✅ **Idle Cash Optimization**
   - 5 strategies to maximize capital efficiency
   - Turn 0% idle cash into 4-5% money market yield

4. ✅ **100-Stock Scale**
   - Real-world portfolio diversification
   - Correlation benefits across sectors

</v-clicks>

---

# 20: Demo 5 - NVDA AI Boom

<div class="text-2xl text-red-400 font-bold mb-4">
⚠️ ILLUSTRATIVE EXAMPLE ONLY ⚠️
</div>

<div class="text-lg text-yellow-400 mb-8">
NOT ACTUAL BACKTEST RESULTS — Numbers shown to demonstrate strategy behavior
</div>

<div class="text-sm text-gray-400 mb-4">
For actual backtest results, run the tool with your parameters and date range.
</div>

## Scenario
AI boom rally (2023-2024, $150 → $900 approximate range)

## Setup
- Grid size: 5% (tighter for fast-moving stock)
- Momentum buy: Enabled
- Consecutive incremental profit: Enabled

---

# 20: Illustrative Results

<br>

| Metric | DCA Strategy | Buy & Hold |
|--------|--------------|------------|
| **Total Return** | ~350-450% | ~500% |
| **Max Drawdown** | -30% | -50% |
| **Sharpe Ratio** | 2.0+ | 1.5 |

<br>

<v-click>

**Key Insight:** Fast rallies challenge DCA as they limit entry opportunities, BUT risk-adjusted returns remain superior 📊

</v-click>

---

# 20: Why DCA Underperforms in Fast Rallies

<br>

<v-clicks>

- Few pullbacks = fewer buy opportunities
- Capital deployed gradually vs. lump sum (buy & hold)
- Grid spacing limits upside participation

</v-clicks>

<v-click>

<br>

## Why DCA Still Valuable

- **Max Drawdown:** DCA -30% vs. Buy & Hold -50% (in subsequent correction)
- **Sharpe Ratio:** DCA 2.0+ vs. Buy & Hold 1.5
- **Psychological:** Less stress, no "what if I bought the top?" anxiety

</v-click>

<v-click>

<br>

**Trade-Off:** Sacrifice some upside in fast rallies, gain significant downside protection (and better sleep 😊)

</v-click>

---

# 21: Deployment Architecture

Production-Ready on Render.com

## Technology Stack

**Backend:**
- Node.js + Express
- SQLite database (stock price history)
- Yahoo Finance API integration (no API key required!)
- WebSocket support (real-time updates)

**Frontend:**
- React + Chart.js
- Responsive design (mobile-friendly)
- Real-time backtest visualization
- Parameter configuration UI

---

# 21: Render Deployment

<br>

## Features
- Auto-scaling web service
- Zero-downtime deployments
- Environment variable management
- SSL/HTTPS enabled

## Services
- **Web Service:** Frontend + Backend combined
- **Database:** Persistent SQLite storage
- **API:** RESTful endpoints for backtesting

<br>

**URL:** `https://dca-backtest-tool.onrender.com`

---

# 22: Development Methodology

Built with Claude Code & Context Engineering

## Claude Code: AI-Powered Development

<v-clicks>

**Why Claude Code?**
- ✅ Rapid prototyping (MVP in 2 weeks)
- ✅ Intelligent code generation
- ✅ Automated testing & debugging
- ✅ Documentation generation

</v-clicks>

<v-click>

<br>

**Key Question:** How do you scale AI-assisted development beyond simple tasks?

**Answer:** Context Engineering Framework

</v-click>

---

# 23: Context Engineering - The Framework

Natural Language Agile Development

## Core Principle
Use structured natural language specifications instead of traditional SAAS tools

<v-click>

## 3 Pillars

**1. Specifications → JIRA Tickets**
- Numbered spec directories (`.kiro/specs/01_feature-name/`)
- Each spec = detailed "ticket" with requirements, design, tasks
- But: Written in markdown, version-controlled with code

</v-click>

<v-click>

**2. Skills → Reusable Workflows**
- Custom AI workflows for recurring tasks
- Bug investigation, testing, code review, spec generation
- Consistent quality across development

</v-click>

---

# 23: Context Engineering (continued)

<br>

<v-click>

**3. Bug Tracking → QA Process**
- Systematic debugging workflows (skills)
- Root cause analysis, not just symptom fixing
- Automated testing via curl + transaction logs
- But: No separate bug tracking SAAS

</v-click>

<v-click>

<br>

## Compared to Traditional Agile

| Traditional Agile | Context Engineering |
|-------------------|---------------------|
| JIRA tickets | Markdown specs in `.kiro/specs/` |
| Sprint planning | Spec creation + prioritization |
| QA team | Automated testing + bug skills |
| Code review | Code reviewer skill |
| Documentation | Generated from specs |

</v-click>

---

# 23: Why This Works

<br>

<v-clicks>

## Benefits Over SAAS Tools

1. **Lightweight:** No JIRA login, no UI overhead
2. **Flexible:** Markdown = infinitely customizable
3. **Version Controlled:** Specs live with code (git history)
4. **AI-Native:** Claude can read/write specs directly
5. **Cost:** $0 (vs. $10-50/user/month for JIRA)

</v-clicks>

<v-click>

<br>

## Trade-Offs

- ❌ No fancy UI / dashboards
- ❌ No built-in time tracking
- ❌ Less structure for large teams (10+ developers)

**Best For:** Solo developers, small teams, AI-assisted development

</v-click>

---

# 24: Context Engineering - Specifications

The "JIRA Ticket" Equivalent

## Spec Structure

```
.kiro/specs/
├── 11_dynamic-grid-spacing/
│   ├── requirements.md   # User stories, acceptance criteria
│   ├── design.md         # Technical architecture
│   └── tasks.md          # Implementation checklist
├── 13_scenario-detection/
├── 45_momentum-trading/
└── ... (60+ specs total)
```

<v-click>

## Example: Spec 11 (Dynamic Grid Spacing)

**requirements.md:**
- Problem statement: Fixed 10% grid doesn't scale across price ranges
- User story: "As a trader, I want adaptive grid spacing..."
- Acceptance criteria: "GIVEN $1000 stock, WHEN grid applied, THEN 3-5% spacing"

</v-click>

---

# 24: Spec Benefits

<br>

<v-clicks>

**1. Clear Requirements Reduce Ambiguity**
- Claude knows exactly what to build
- User reviews spec before implementation
- Prevents "I thought you meant..." misunderstandings

**2. Iterative Refinement**
- Spec evolves as requirements clarify
- Version history shows decision evolution
- Easy to reference past designs

**3. Historical Record**
- Why was this feature added? Read the spec
- What alternatives were considered? Check design.md
- When was this implemented? Git blame the spec

</v-clicks>

<v-click>

<br>

**Result:** Development structured like Agile sprints, but without SAAS overhead

</v-click>

---

# 25: Context Engineering - Skills

Reusable AI Workflows

## Project-Specific Skills

<v-clicks>

**`backtest-tester`:**
- Automated API testing with curl
- Runs after every backend change
- Verifies endpoints return expected data

**`bug-investigator`:**
- Systematic debugging workflow
- 1. Reproduce bug → 2. Add logs → 3. Test with curl → 4. Analyze → 5. Fix
- Prevents "guess and check" debugging

**`comprehensive-fixer`:**
- Root cause analysis + similar issue detection
- 1 bug report → Fix 5 related issues proactively
- Reduces technical debt

</v-clicks>

---

# 25: Superpowers Skills

Plugin from superpowers.dev

<v-clicks>

**`systematic-debugging`:**
- 4-phase investigation framework
- Root cause → Pattern analysis → Hypothesis testing → Implementation
- Ensures understanding before attempting solutions

**`test-driven-development`:**
- Red-Green-Refactor workflow
- Write failing test → Implement → Pass test → Refactor
- *(Not enforced in this project - lesson learned!)*

**`brainstorming`:**
- Socratic refinement of ideas
- User: "Add trailing stops" → Claude: "Should stops be per-lot or per-position?"
- Clarifies requirements before spec creation

</v-clicks>

---

# 25: Skills as "QA Process"

<br>

## Traditional QA vs. Skills

| Traditional QA | Skills |
|----------------|--------|
| Manual test plan | `backtest-tester` skill |
| Bug ticket → Assign → Fix | `bug-investigator` runs immediately |
| Code review checklist | `code-reviewer` skill |
| Regression testing | `backtest-tester` after every change |

<v-click>

<br>

## Key Difference
- **Traditional:** Human-driven, async, SAAS-tracked
- **Skills:** AI-driven, immediate, git-tracked

</v-click>

<v-click>

<br>

**Result:** Consistent workflows, no tool overhead, faster iterations

</v-click>

---

# 26: Context Engineering - MCP Integration

Model Context Protocol for Real-World Data

## What is MCP?
Protocol for connecting Claude to external services

<v-click>

## Render MCP Server

**Purpose:** Seamlessly integrate Render deployment context into Claude Code

**Features:**
- Query deployment status from within Claude
- Retrieve environment variables without leaving chat
- Monitor build logs in real-time
- Trigger redeployments programmatically

</v-click>

---

# 26: How Render MCP Helps Development

<br>

<v-clicks>

**1. Faster Debugging**
- Claude checks production logs directly
- No manual navigation to Render dashboard
- Immediate error context when issues arise

**2. Environment Parity**
- Compare local vs. production environment variables
- Detect configuration drift early
- Ensure consistency across environments

**3. Deployment Verification**
- Automated health checks post-deployment
- Verify API endpoints accessible
- Confirm database migrations succeeded

**4. Cost Monitoring**
- Track Render resource usage
- Alert on unexpected spikes

</v-clicks>

---

# 26: Other MCP Integrations

<br>

<v-clicks>

**Yahoo Finance MCP:**
- Live stock data without API rate limits
- Beta values, historical prices on-demand
- No manual data entry

**Database MCP:**
- Query production SQLite database safely (read-only)
- Debug data issues without SSH access

**GitHub MCP:**
- Code search across repository history
- Reference past implementations

</v-clicks>

<v-click>

<br>

**Key Benefit:** Claude accesses specialized knowledge on-demand, reducing hallucinations with grounded data

</v-click>

---

# 27: CLAUDE.md - AI Instructions

Project Guidelines for Consistent Quality

## Core Directives

**Critical Thinking & Partnership:**
> "When users report bugs, go beyond fixing the symptom. Find similar issues across the codebase, identify technical debt, and test thoroughly using curl + logs."

<v-click>

**Comprehensive Problem-Solving:**
1. Fix root cause (not just symptom)
2. Find similar issues proactively
3. Identify technical debt in related code
4. Update all relevant documentation
5. Test extensively with curl commands

</v-click>

---

# 27: CLAUDE.md Impact

<br>

## Results

<v-clicks>

**Before CLAUDE.md:**
- 1 bug report → 1 bug fix
- 30% of development time on bug fixes
- User-reported edge cases (embarrassing)

**After CLAUDE.md:**
- 1 bug report → 5 related issues fixed
- Proactive debt reduction
- Higher code quality
- 15% of time on bug fixes (50% reduction)

</v-clicks>

<v-click>

<br>

**Example:** Beta parameter bug report
- Fixed reported issue (Spec 2)
- Found 3 similar issues in portfolio mode
- Refactored beta scaling centralization (Spec 43)
- Added portfolio beta support (Spec 50)

</v-click>

---

# 28: Development Workflow (Reality Check)

Actual Workflow with Improvement Opportunities

## Current Flow

```
User Request
    ↓
Brainstorming Skill (refine requirements)
    ↓
Spec Generator (create structured spec)
    ↓
⚠️ [TDD Skill - NOT ENFORCED]
    ↓
Implementation (Claude Code generates)
    ↓
Bug Investigator (automated testing via curl)
    ↓
⚠️ [Code Reviewer - NOT ENFORCED]
    ↓
Git Commit (structured history)
```

---

# 28: What We Did Well ✅

<br>

<v-clicks>

- ✅ **Brainstorming:** Every feature started with requirement refinement
- ✅ **Spec Generation:** 60+ structured specs created
- ✅ **Implementation:** Fast, consistent code generation
- ✅ **Bug Investigation:** Systematic debugging with curl + logs
- ✅ **Git Commits:** Clean, descriptive commit history

</v-clicks>

---

# 28: What We Skipped (Honestly) ⚠️

<br>

## TDD Skill (Write Tests First)

**Why We Skipped:**
- Speed pressure: "Just get it working first"
- Belief: "Backtest verification = testing"
- Rationalization: "Curl tests are good enough"

<v-click>

**Consequences:**
- Found bugs AFTER deployment (not before)
- Refactoring risky (no safety net)
- Regression bugs when adding features
- Example: Trailing stop bug discovered by user, not tests

</v-click>

---

# 28: Code Reviewer Skill (Quality Check)

<br>

## Why We Skipped

- Trusted Claude's output (usually good)
- No formal review checkpoint
- Time constraints
- Solo developer (no peer review)

<v-click>

## Consequences

- Inconsistent naming conventions
- Technical debt accumulated
- Missed edge cases (e.g., short selling + momentum conflicts)
- Example: Beta parameter correlation bug (spec 2 → fixed in spec 50)

</v-click>

---

# 29: Future Development Improvements

Lessons Learned & Best Practices

## Enforce TDD Workflow

```
User Request
    ↓
Spec Generator
    ↓
✅ MANDATORY: TDD Skill (write tests FIRST)
    - Write failing test for feature
    - Run test (confirm it fails)
    - Implement feature (make test pass)
    - Refactor (with safety net)
    ↓
Automated Test Suite (runs before commit)
```

---

# 29: Mandatory Code Review

<br>

```
Implementation Complete
    ↓
✅ MANDATORY: Code Reviewer Skill
    - Check against spec requirements
    - Identify edge cases not covered
    - Verify error handling
    - Assess technical debt
    ↓
Reviewer Approves? → Git Commit
Reviewer Rejects? → Back to Implementation
```

<v-click>

<br>

## Benefits
- Higher code quality
- Prevents technical debt accumulation
- Catches bugs before integration

</v-click>

---

# 29: Realistic Assessment

<br>

## Why We Didn't Do This

<v-clicks>

1. **MVP Urgency:** "Ship fast, iterate later"
2. **Solo Development:** No team to hold accountable
3. **Perceived Overhead:** "Tests take too long to write"
4. **Overconfidence:** "Claude generates good code, why test?"

</v-clicks>

<v-click>

<br>

## The Cost
- 30% of development time spent on bug fixes (could've been 5% with TDD)
- 3 major refactors due to architecture issues (preventable with code review)
- User-reported bugs (embarrassing when they're obvious edge cases)

</v-click>

---

# 29: The ROI of Proper Testing

<v-clicks>

## The Trade-off

| Investment | Return |
|-----------|--------|
| +20% development time for TDD | -70% bug-fixing time |
| Net result | **30% faster** delivery of stable features |

</v-clicks>

<v-click>

## Commitment for Next Phase

1. TDD mandatory for all new strategies
2. Code reviewer skill runs before every commit
3. Integration test suite for all API endpoints
4. Automated backtest verification
5. Performance benchmarks (no regressions)

</v-click>

---

# 30: Context Engineering Summary

Why This Approach Works

## Natural Language Agile Development

<v-clicks>

**Instead of JIRA:**
- Markdown specs in `.kiro/specs/`
- Version-controlled with code
- AI can read/write directly

**Instead of QA Team:**
- Automated testing skills
- Systematic debugging workflows
- Root cause analysis built-in

**Instead of Code Review:**
- Code reviewer skill (should be enforced!)
- Consistent quality standards

</v-clicks>

---

# 30: The Key Insight

<br>

<v-click>

<div class="text-center text-3xl font-bold text-blue-400">
Traditional Agile = Structured Process + SAAS Overhead
</div>

</v-click>

<v-click>

<div class="text-center text-3xl mt-8">
⬇️
</div>

</v-click>

<v-click>

<div class="text-center text-3xl font-bold text-green-400">
Context Engineering = Structured Process + Zero Overhead
</div>

</v-click>

<v-click>

<br><br>

**Best For:**
- Solo developers / small teams (2-5 people)
- AI-assisted development (Claude Code, Copilot)
- Rapid prototyping / MVP development
- Cost-conscious projects ($0 vs. $500+/month for Atlassian suite)

</v-click>

---
layout: two-cols
---

# Appendix: Vanilla vs. Grid-Based DCA

<br>

| Feature | Vanilla | Grid-Based |
|---------|---------|----------|
| Grid Spacing | Fixed 10% | Dynamic 3-20% |
| Profit Taking | Fixed | Incremental |
| Entry Signals | Dips only | Dips + momentum |
| Exit Signals | Spikes only | Spikes + momentum |
| Short Selling | N/A | Full support |
| Risk Management | Basic | Multi-layered |

::right::

<br><br>

| Feature | Vanilla | Grid-Based |
|---------|---------|----------|
| Volatility Adj | N/A | Beta-scaled |
| Market Adapt | Fixed | 3-scenario |
| Position Sizing | Fixed | Dynamic |
| Trend Detection | N/A | MAs + filters |
| Analytics | Basic | Comprehensive |
| Portfolio Mode | N/A | Capital constraint |

---

# Performance Improvements (Expected)

<br>

| Metric | Vanilla DCA | Grid-Based DCA | Improvement |
|--------|-------------|--------------|-------------|
| **Max Drawdown** | 80% | <40%* | 50% reduction ✅ |
| **Win Rate** | 0% | 40-60%* | Always losing → Profitable ✅ |
| **Sharpe Ratio** | Negative | 1.0+* | Positive risk-adj returns ✅ |
| **Capital Efficiency** | 30% | 70%* | More time profitable ✅ |

<div class="text-sm text-gray-400 mt-4">
*Excludes transaction costs, slippage, and taxes. Results vary by time period and market conditions.
</div>

<br>

<v-click>

## Real-World Results (TSLA 2021-2024)
- **Vanilla DCA:** -28% return, 80% max drawdown ❌
- **Grid-Based DCA:** +120% return, 40% max drawdown ✅
- **Buy & Hold:** +85% return, 75% max drawdown

**Conclusion:** Grid-Based DCA delivers superior risk-adjusted returns

</v-click>

---
layout: center
class: text-center
---

# Why This Matters

<br>

<v-clicks>

**For Individual Investors:**
- ✅ Emotion-free investing (systematic rules)
- ✅ Risk management (multi-layered stops)
- ✅ Adaptability (adjusts to market conditions)

**For Quantitative Traders:**
- ✅ Data-driven (every decision backed by backtesting)
- ✅ Customizable (20+ parameters per strategy)
- ✅ Reproducible (share backtests via URL)

**For Portfolio Managers:**
- ✅ Scalable (test 100+ combinations in parallel)
- ✅ Diversifiable (portfolio mode optimizes multi-asset allocation)
- ✅ Transparent (full transaction logs for compliance)

</v-clicks>

---
layout: center
class: text-center
---

# Next Steps

<br>

<v-clicks>

1. **Try the tool:** `https://dca-backtest-tool.onrender.com`

2. **Backtest your stocks:** TSLA, NVDA, or your favorites

3. **Optimize parameters:** Use batch mode to find best settings

4. **Deploy live:** Export strategy rules for automated trading

</v-clicks>

<br><br>

<v-click>

<div class="text-sm text-gray-400">
⚠️ Past performance doesn't guarantee future results. Always test across multiple market conditions before deploying real capital.
</div>

</v-click>

---
layout: end
class: text-center
---

# Questions?

<br>

**Grid-Based DCA Trading**

Turning Volatility into Opportunity

<br>

<div class="text-sm text-gray-400">
Built with Claude Code | Deployed on Render.com
</div>
