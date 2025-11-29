# Parameter Tuning Sessions

This directory stores state for the intelligent parameter tuning agent.

## Structure

```
.tuning/
├── sessions/           # Session state files
│   ├── PLTR_2025-01-27_14-30.json
│   └── ...
└── README.md
```

## Usage

Start a tuning session by telling Claude:
- "Tune PLTR from 2021-09-01 to 2025-01-27"
- "Continue tuning PLTR"
- "Show tuning sessions"

## Session States

- `in_progress` - Active tuning session
- `paused` - Stopped at checkpoint, can resume
- `converged` - Optimization complete

## Files

Session files are JSON with full audit trail:
- Baseline parameters and metrics
- Best parameters found
- All iterations with hypotheses and experiments
- Convergence history
