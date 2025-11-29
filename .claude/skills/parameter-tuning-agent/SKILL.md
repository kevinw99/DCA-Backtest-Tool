---
name: parameter-tuning-agent
description: Intelligent parameter tuning for DCA backtests. Use when user wants to optimize backtest parameters for a stock. Handles hypothesis generation, experimentation, and convergence detection.
---

# Parameter Tuning Agent

You ARE the tuning agent. When this skill is invoked, you run an intelligent parameter optimization loop.

## Quick Reference

| Command | Action |
|---------|--------|
| "Tune {SYMBOL}" | Start new tuning session |
| "Continue tuning {SYMBOL}" | Resume existing session |
| "Show tuning sessions" | List all sessions |
| "Show tuning results for {SYMBOL}" | Display session details |

## Session State Location

`.tuning/sessions/{SYMBOL}_{timestamp}.json`

## Tuning Loop

```
1. INITIALIZE
   - Check for existing session or create new
   - Load/set baseline parameters
   - Run baseline backtest
   - Record baseline metrics

2. ITERATE (repeat until convergence)
   a. HYPOTHESIZE - Form hypothesis about what param to vary
   b. EXPERIMENT - Run 3-5 variations
   c. ANALYZE - Compare results, update best
   d. CHECKPOINT - Every 5 iterations, report and ask user

3. CONVERGE
   - When improvement < 1% for 3 cycles
   - Report final best params
```

## Parameter Tiers (Tune in Order)

**Tier 1 - High Impact:**
- gridIntervalPercent: [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25]
- profitRequirement: [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25]

**Tier 2 - Medium Impact:**
- trailingBuyActivationPercent: [0.05, 0.08, 0.10, 0.12, 0.15, 0.20]
- trailingBuyReboundPercent: [0.03, 0.05, 0.08, 0.10, 0.12]
- trailingSellActivationPercent: [0.10, 0.15, 0.20, 0.25, 0.30]
- trailingSellPullbackPercent: [0.05, 0.08, 0.10, 0.12, 0.15]

**Tier 3 - Fine-tuning:**
- maxLots: [5, 8, 10, 12, 15, 20]
- maxLotsToSell: [1, 2, 3, 4, 5]

## Running a Backtest

Use curl to call the API:

```bash
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2021-09-01",
    "endDate": "2025-01-27",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.15,
    "trailingSellPullbackPercent": 0.08
  }' | jq '{
    cagr: .data.metrics.annualizedReturnPercent,
    totalReturn: .data.metrics.totalReturnPercent,
    sharpe: .data.metrics.sharpeRatio,
    sortino: .data.metrics.sortinoRatio,
    maxDrawdown: .data.metrics.maxDrawdownPercent,
    winRate: .data.metrics.winRate,
    totalTrades: .data.metrics.totalTrades,
    capitalUtilization: .data.metrics.capitalUtilization
  }'
```

## Session File Structure

```json
{
  "sessionId": "PLTR_2025-01-27_14-30",
  "symbol": "PLTR",
  "dateRange": { "start": "2021-09-01", "end": "2025-01-27" },
  "objective": "maximize_cagr",
  "status": "in_progress",
  "baseline": {
    "params": { ... },
    "metrics": { ... }
  },
  "bestSoFar": {
    "params": { ... },
    "metrics": { ... },
    "foundAtIteration": 8
  },
  "iterations": [
    {
      "id": 1,
      "hypothesis": "...",
      "paramsVaried": ["gridIntervalPercent"],
      "experiments": [ ... ],
      "conclusion": "..."
    }
  ],
  "convergenceHistory": [15.2, 16.8, 18.1]
}
```

## Workflow When Starting New Session

1. Create `.tuning/sessions/` directory if not exists
2. Generate session ID: `{SYMBOL}_{YYYY-MM-DD}_{HH-mm}`
3. Get default parameters (or user-provided)
4. Run baseline backtest
5. Save initial session state
6. Begin iteration loop

## Workflow When Resuming

1. Read `.tuning/sessions/{SYMBOL}_*.json` (most recent)
2. Report session status to user
3. Ask: "Continue from iteration N?"
4. Resume iteration loop

## Checkpoint Report Format

```
=== TUNING CHECKPOINT (Iteration 10) ===

Progress: CAGR improved 15.2% → 19.1% (+25.6%)
Best params found:
  - gridIntervalPercent: 0.15
  - profitRequirement: 0.12
  - trailingBuyActivationPercent: 0.10

Currently exploring: Tier 2 (trailing settings)
Convergence: Not yet (still improving)

Options:
1. Continue (default)
2. Focus on specific param
3. Add constraint (e.g., max drawdown < 20%)
4. Stop and use current best
```

## Convergence Detection

Track last 5 best CAGR values. Converge when:
- Std deviation of last 5 values < 0.5%
- OR improvement from iteration N-3 to N < 1%
- OR user says "stop"

## Key Principles

1. **One param at a time** - Vary one param while holding others constant
2. **Record everything** - Every experiment logged with reasoning
3. **Hypothesis-driven** - Always state WHY you're trying something
4. **Interactive** - Checkpoint every 5 iterations for user feedback
5. **Persistent** - State saved after every iteration

## Example Session Start

```
User: "Tune PLTR from 2021-09-01 to 2025-01-27"

Agent:
1. mkdir -p .tuning/sessions
2. Run baseline backtest with defaults
3. Save session file
4. Report: "Baseline CAGR: 15.2%. Beginning optimization..."
5. Hypothesis: "Start with gridIntervalPercent - highest impact param"
6. Run experiments: grid = [0.08, 0.10, 0.12, 0.15]
7. Analyze: "0.15 gave best CAGR (17.1%), +1.9% improvement"
8. Update bestSoFar, save session
9. Continue to next param...
```
