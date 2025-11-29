# Intelligent Parameter Tuning Agent - Requirements

## Problem Statement

Current batch backtest mode requires manually selecting parameter combinations, leading to:
- Exponential growth in combinations as params/values increase
- No intelligent search - exhaustive enumeration
- No hypothesis-driven exploration
- No persistence of tuning progress

## Solution

An AI-powered tuning agent that:
1. Starts from good default parameters
2. Hypothesizes which parameters have most impact
3. Experiments systematically with focused variations
4. Observes results and decides optimal values
5. Iterates until convergence
6. Persists state for session continuity

## Functional Requirements

### FR-1: Session Management
- FR-1.1: Create new tuning sessions with symbol and date range
- FR-1.2: Resume existing sessions from persisted state
- FR-1.3: List all tuning sessions
- FR-1.4: View detailed results of any session

### FR-2: Optimization Loop
- FR-2.1: Run baseline backtest with starting parameters
- FR-2.2: Generate hypotheses about parameter importance
- FR-2.3: Execute focused experiments (3-5 variations per iteration)
- FR-2.4: Analyze results and update best configuration
- FR-2.5: Detect convergence automatically

### FR-3: User Interaction
- FR-3.1: Report progress at checkpoints (every 5 iterations)
- FR-3.2: Accept user feedback to adjust search direction
- FR-3.3: Allow early stopping with current best params

### FR-4: Persistence
- FR-4.1: Save session state after every iteration
- FR-4.2: Include full audit trail (hypotheses, experiments, conclusions)
- FR-4.3: Support session resumption across CLI restarts

## Non-Functional Requirements

### NFR-1: Performance
- Each iteration should complete in < 30 seconds
- Convergence typically within 20-50 iterations

### NFR-2: Usability
- Natural language commands to start/resume/review sessions
- Clear progress reports with improvement metrics

### NFR-3: Reliability
- No work lost on CLI close (persistent state)
- Graceful handling of API failures

## Optimization Target

**Primary (v1):** Maximize CAGR (annualizedReturnPercent)

**Future:**
- Risk-adjusted: Sharpe, Sortino
- Constrained: Max CAGR where drawdown < X%
- Multi-objective: Pareto frontier of CAGR vs drawdown

## Scope

**In Scope (v1):**
- Single stock backtest tuning
- Long strategy parameters
- CAGR optimization

**Out of Scope (v1):**
- Portfolio tuning (multiple stocks)
- Short strategy parameters
- Autonomous overnight operation
