# Adaptive DCA Strategy Simulator - Documentation Index

This index provides a comprehensive view of all project documentation organized by category.

---

## Essential Documentation (Root)

- [README.md](../README.md) - Project overview and getting started
- [CLAUDE.md](../CLAUDE.md) - Instructions for Claude Code
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide

---

## Status & Progress

**Current Status:**
- [DEBUGGING_COMPLETE_SUMMARY.md](status/DEBUGGING_COMPLETE_SUMMARY.md) - Debugging session summary
- [IMPLEMENTATION_PLAN.md](status/IMPLEMENTATION_PLAN.md) - Implementation roadmap

---

## Design Documents

**Requirements & Design:**
- [REQUIREMENTS.md](design/REQUIREMENTS.md) - Detailed requirements specification
- [REQUIREMENT_SHORT.md](design/REQUIREMENT_SHORT.md) - Abbreviated requirements
- [short-selling-algorithm-updates.md](design/short-selling-algorithm-updates.md) - Short selling algorithm updates

---

## Analysis & Research

**Strategy Analysis:**
- [DCA_STRATEGY_IMPROVEMENTS.md](analysis/DCA_STRATEGY_IMPROVEMENTS.md) - DCA strategy enhancement proposals
- [TSLA_TRAILING_STOP_ANALYSIS.md](analysis/TSLA_TRAILING_STOP_ANALYSIS.md) - TSLA trailing stop behavior analysis
- [BATCH_URL_PARAMETER_ANALYSIS.md](analysis/BATCH_URL_PARAMETER_ANALYSIS.md) - Batch backtest URL parameter analysis

---

## Testing Documentation

**Test Results & Reports:**
- [portfolio-backtest-complete-results.md](testing/portfolio-backtest-complete-results.md) - Portfolio backtest complete results
- [rejected-orders-test.md](testing/rejected-orders-test.md) - Rejected orders test documentation

**Test Fixtures:** (in `test/fixtures/`)
- `test_aapl.json` - Apple stock test configuration
- `test_tsla_single.json` - Tesla single backtest test
- `test_batch.json` - Batch backtest test
- `test_app_phase1.json` - Phase 1 app test
- `test_app_phase1_correct.json` - Phase 1 corrected test

**Test Results:** (in `test/results/`)
- `testResults.txt` - General test results
- `portfolio-result.json` - Portfolio backtest results

**Test Metrics:**
- `baseline-metrics.json` - Performance baseline metrics

---

## Reference Material

**System Documentation:**
- [AGENTS.md](reference/AGENTS.md) - Agent system documentation
- [VERIFIED_URLS.md](reference/VERIFIED_URLS.md) - List of verified API endpoints
- [API_DOCUMENTATION.md](reference/API_DOCUMENTATION.md) - API endpoint documentation
- [ENVIRONMENT_CONFIGURATION.md](reference/ENVIRONMENT_CONFIGURATION.md) - Environment setup and configuration
- [URL_PARAMETER_DEFAULTS.md](reference/URL_PARAMETER_DEFAULTS.md) - URL parameter defaults reference
- [momentum-parameters.md](reference/momentum-parameters.md) - Momentum trading parameters

---

## Guides

**User & Developer Guides:**
- [BETA_CORRELATION_GUIDE.md](guides/BETA_CORRELATION_GUIDE.md) - Beta correlation usage guide
- [momentum-trading.md](guides/momentum-trading.md) - Momentum trading guide

---

## Specifications

All feature specifications are in `.kiro/specs/` directory with numbered folders:

1. `01_algo-performance-calculation/` - Algorithm performance calculation
2. `02_beta-parameter-correlation/` - Beta parameter correlation
3. `03_beta-api-endpoint-fix/` - Beta API endpoint fix
4. `04_batch-data-refresh-and-parameter-revert-fix/` - Batch data refresh fixes
5. `05_beta-parameter-update-fix/` - Beta parameter update fix
6. `06_beta-controls-calculation-fix/` - Beta controls calculation fix
7. `07_url-based-backtest-configuration/` - URL-based backtest config
8. `08_codebase-refactoring-and-debt-reduction/` - Codebase refactoring
9. `09_automatic-data-gap-detection/` - Automatic data gap detection
10. `10_batch-progress-real-time-updates/` - Batch progress updates
11. `11_dynamic-grid-spacing/` - Dynamic grid spacing
12. `12_consecutive-incremental-profit-requirement/` - Consecutive profit requirements
13. `13_dca-scenario-detection-and-adaptation/` - DCA scenario detection
14. `14_remove-consolidate-annualized-return-metrics/` - Annualized return metrics
15. `15_real-time-adaptive-strategy/` - Real-time adaptive strategy
16. `16_ticker-specific-default-parameters/` - Ticker-specific defaults

See [.kiro/specs/README.md](../.kiro/specs/README.md) for details on each spec.

---

## Scripts

**Utility Scripts:** (in `scripts/`)
- `restart_server.sh` - Server restart utility
- `colorize_session.py` - Session output colorization

**Test Scripts:** (in `test/scripts/`)
- `backtest_dca_optimized.js` - Optimized DCA backtest test
- `compare_strategies.js` - Strategy comparison utility

---

## Data Files

**Backtest Results:** (in `data/backtest-results/`)
- `tsla_nov2021_dec2024.json` - TSLA backtest data (Nov 2021 - Dec 2024)

---

## Organization Rules

- [.docs-rules.md](../.docs-rules.md) - Documentation organization rules
- [.file-rules.md](../.file-rules.md) - File organization rules

---

## Quick Navigation

### By Category
- **Status** → `docs/status/`
- **Design** → `docs/design/`
- **Analysis** → `docs/analysis/`
- **Testing** → `docs/testing/`
- **Reference** → `docs/reference/`
- **Archive** → `docs/archive/`

### By Type
- **Specifications** → `.kiro/specs/##_name/`
- **Test Configs** → `test/fixtures/`
- **Test Results** → `test/results/`
- **Scripts** → `scripts/`
- **Data** → `data/backtest-results/`

---

**Last Updated:** 2025-11-20
