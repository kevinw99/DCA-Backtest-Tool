# Intelligent Parameter Tuning Agent - Design Document

## Overview

An AI-powered parameter tuning agent that operates within Claude Code CLI sessions to intelligently optimize DCA backtest parameters. The agent uses a hybrid approach: algorithmic search strategies combined with LLM reasoning for hypothesis generation and result interpretation.

## Architecture: Approach C - Claude Code as Agent

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code CLI Session                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Claude (Opus) = The Tuning Agent                      │ │
│  │  - Runs optimization loop via conversation             │ │
│  │  - Calls backtest API via curl                         │ │
│  │  - Persists state to .tuning/ directory                │ │
│  │  - Reports checkpoints for user interaction            │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│            ┌──────────────────────────────┐                │
│            │  .tuning/sessions/*.json     │                │
│            │  (Persistent State)          │                │
│            └──────────────────────────────┘                │
│                           │                                 │
│                           ▼                                 │
│            ┌──────────────────────────────┐                │
│            │  POST /api/backtest/dca      │                │
│            │  (Existing Backend API)      │                │
│            └──────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Tuning Session State (Persistence)

**Location:** `.tuning/sessions/{symbol}_{timestamp}.json`

```json
{
  "sessionId": "PLTR_2025-01-27_14-30",
  "symbol": "PLTR",
  "dateRange": { "start": "2021-09-01", "end": "2025-01-27" },
  "objective": "maximize_cagr",
  "constraints": {
    "maxDrawdownPercent": null,
    "minWinRate": null
  },
  "status": "in_progress",

  "baseline": {
    "params": { "gridIntervalPercent": 0.10, "profitRequirement": 0.10, "..." },
    "metrics": { "cagr": 15.2, "sharpe": 1.1, "maxDrawdown": 18.5, "..." }
  },

  "bestSoFar": {
    "params": { "..." },
    "metrics": { "..." },
    "foundAtIteration": 8,
    "improvementFromBaseline": "+23%"
  },

  "iterations": [
    {
      "id": 1,
      "tier": 1,
      "hypothesis": "Widen grid interval to reduce overtrading",
      "reasoning": "Current 10% grid may trigger too frequently in volatile periods",
      "paramsVaried": ["gridIntervalPercent"],
      "paramsHeld": { "profitRequirement": 0.10, "..." },
      "experiments": [
        { "params": { "gridIntervalPercent": 0.08 }, "metrics": { "cagr": 14.1 } },
        { "params": { "gridIntervalPercent": 0.10 }, "metrics": { "cagr": 15.2 } },
        { "params": { "gridIntervalPercent": 0.12 }, "metrics": { "cagr": 16.8 } },
        { "params": { "gridIntervalPercent": 0.15 }, "metrics": { "cagr": 17.1 } }
      ],
      "bestInIteration": { "gridIntervalPercent": 0.15, "cagr": 17.1 },
      "conclusion": "Wider grid (15%) improved CAGR by 1.9%, likely due to reduced churn",
      "timestamp": "2025-01-27T14:35:00Z"
    }
  ],

  "convergenceHistory": [15.2, 16.8, 18.1, 18.5, 18.7],
  "checkpoints": [
    { "iteration": 5, "userFeedback": "focus on reducing drawdown", "adjustedObjective": false }
  ]
}
```

### 2. Tuning Loop Algorithm

```
PHASE 1: INITIALIZE
├─ Load or create session state
├─ Set baseline params (defaults or user-provided)
├─ Run baseline backtest
└─ Record baseline metrics

PHASE 2: ITERATE (repeat until convergence)
├─ HYPOTHESIS (LLM reasoning)
│   ├─ Analyze current best metrics
│   ├─ Review what's been tried
│   ├─ Form hypothesis about what to vary next
│   └─ Select 1-2 params from current tier
│
├─ EXPERIMENT (algorithmic)
│   ├─ Generate 3-5 variations using ternary search
│   ├─ Run backtests for each variation
│   ├─ Record all results
│   └─ Update bestSoFar if improved
│
├─ ANALYZE (LLM reasoning)
│   ├─ Compare results to hypothesis
│   ├─ Draw conclusions
│   ├─ Decide: continue this param or move to next
│   └─ Record reasoning in iteration log
│
└─ CHECKPOINT (every 5 iterations)
    ├─ Report progress to user
    ├─ Show improvement trajectory
    ├─ Ask for direction/feedback
    └─ Optionally adjust focus

PHASE 3: CONVERGENCE
├─ Detect: improvement < 1% for 3 consecutive cycles
├─ OR: user says "stop"
├─ Report final results
└─ Save session as "converged"
```

### 3. Parameter Importance Hierarchy

**Tier 1 - High Impact (tune first):**
- `gridIntervalPercent` (0.05 - 0.25)
- `profitRequirement` (0.05 - 0.25)
- `lotSizeUsd` (affects position sizing)

**Tier 2 - Medium Impact (tune second):**
- `trailingBuyActivationPercent` (0.05 - 0.25)
- `trailingBuyReboundPercent` (0.03 - 0.15)
- `trailingSellActivationPercent` (0.10 - 0.30)
- `trailingSellPullbackPercent` (0.05 - 0.20)

**Tier 3 - Fine-tuning (tune last):**
- `maxLots` (5 - 20)
- `maxLotsToSell` (1 - 5)
- Dynamic grid settings
- Consecutive increment settings
- Beta scaling coefficient

### 4. Search Strategy

**Ternary Search for Each Parameter:**
```
Given: current value V, step size S
Test: [V-S, V, V+S]
If V-S wins → expand left: test [V-2S, V-S, V]
If V+S wins → expand right: test [V, V+S, V+2S]
If V wins → narrow: reduce S by half, repeat
Converge when S < threshold
```

**Interaction Effects (later cycles):**
After individual params stabilize, test theoretically-linked combinations:
- grid × profit (trade-off between frequency and profit per trade)
- trailingBuy × trailingSell (entry vs exit timing)

### 5. User Interaction Model

**Start New Session:**
```
User: "Tune PLTR from 2021-09-01 to 2025-01-27, optimize CAGR"
Agent: Creates session, runs baseline, begins iteration loop
```

**Resume Session:**
```
User: "Continue tuning PLTR"
Agent: Loads most recent session, reports status, continues from last iteration
```

**Checkpoint Interaction:**
```
Agent: "After 10 iterations, CAGR improved 15.2% → 19.1% (+25.6%)
        Best params so far: grid=15%, profit=12%
        Currently exploring: trailing buy settings

        Continue, or adjust focus?"

User: "Continue" / "Focus on drawdown" / "Try wider profit range" / "Stop"
```

**Review Results:**
```
User: "Show tuning results for PLTR"
Agent: Displays session summary, best params, improvement trajectory
```

## File Structure

```
.tuning/
├── sessions/
│   ├── PLTR_2025-01-27_14-30.json
│   ├── AAPL_2025-01-26_09-15.json
│   └── ...
├── defaults/
│   └── parameter_ranges.json  (default search ranges)
└── README.md
```

## Metrics Tracked

**Primary (optimizable):**
- CAGR (annualizedReturnPercent)
- Sharpe Ratio
- Sortino Ratio

**Secondary (constraints/monitoring):**
- Max Drawdown %
- Win Rate %
- Capital Utilization %
- Total Trades
- Profit Factor

## Convergence Criteria

Session converges when ANY of:
1. Improvement < 1% for 3 consecutive iteration cycles
2. User explicitly says "stop"
3. All tiers have been explored with no improvement
4. Maximum iteration limit reached (default: 50)

## Advantages of This Approach

1. **Zero Infrastructure** - Uses existing Claude Code CLI
2. **Full Reasoning Power** - Claude analyzes and hypothesizes
3. **Persistent State** - Sessions survive CLI restarts
4. **Interactive Checkpoints** - User can guide the search
5. **Audit Trail** - Full history of what was tried and why
6. **Resumable** - Pick up where you left off

## Limitations

1. **Session-bound** - Requires active CLI session to run
2. **Sequential** - One experiment at a time (could be parallelized)
3. **API Latency** - Each backtest is an HTTP call

## Future Enhancements

1. **Parallel Experiments** - Run multiple backtests concurrently
2. **Portfolio Tuning** - Extend to multi-stock portfolios
3. **Constraint Optimization** - "Maximize CAGR where drawdown < 20%"
4. **Cross-Symbol Learning** - Transfer insights between similar stocks
5. **Agent SDK Migration** - For fully autonomous operation
