# Generic Parameter Implementation Guides

## Overview

This directory contains comprehensive guides for adding new parameters to the DCA Backtest Tool. These guides document the complete process learned from implementing Spec 45 (Momentum-Based Trading) and other features.

## Purpose

When adding a new parameter to the system, these guides ensure:
- ✅ Complete implementation across all layers
- ✅ Consistency across all modes (single, portfolio, batch)
- ✅ No missing steps that cause bugs
- ✅ Proper testing and verification

## Guide Files

### **G01: Overview and Checklist**
**File**: `G01_overview-and-checklist.md`

**What it covers:**
- High-level architecture overview
- Complete checklist for parameter implementation
- Common pitfalls and how to avoid them
- Multi-mode support principle
- File location reference
- Parameter type guidelines

**When to use**: Start here for any new parameter. Use the checklist to track progress.

---

### **G02: Backend Implementation**
**File**: `G02_backend-implementation.md`

**What it covers:**
- Executor layer (dcaExecutor.js)
- Service layer (dcaBacktestService.js)
- API layer (server.js)
- Parameter flow verification
- Debug logging strategies
- Real-world examples

**When to use**: When implementing backend logic and API handling for a new parameter.

---

### **G03: Configuration and Defaults**
**File**: `G03_configuration-defaults.md`

**What it covers:**
- Global defaults (backtestDefaults.json)
- Ticker-specific defaults
- Configuration hierarchy and precedence
- Format guidelines for different parameter types
- Validation and testing

**When to use**: When adding default values for a new parameter.

---

### **G04: Frontend UI Components**
**File**: `G04_frontend-ui-components.md`

**What it covers:**
- React component structure
- Adding checkboxes, inputs, selects
- State management
- Help text and styling
- Portfolio and batch mode support
- Real-world UI patterns

**When to use**: When creating form controls for a new parameter in the web UI.

---

### **G05: URL Parameter Handling**
**File**: `G05_url-parameter-handling.md`

**What it covers:**
- URL encoding (_encodeSingleParameters)
- URL decoding (_decodeSingleParameters)
- Override support arrays
- Type conversion helpers
- Round-trip testing
- Shareable link generation

**When to use**: When making a parameter available in shareable URLs and deep links.

---

### **G06: Testing and Verification**
**File**: `G06_testing-verification.md`

**What it covers:**
- Backend API testing (curl)
- Frontend UI testing (manual)
- URL parameter testing (shareable links)
- Multi-mode testing (single, portfolio, batch)
- Edge case testing
- Test script templates
- Verification procedures

**When to use**: When testing and verifying a new parameter works correctly across all layers.

---

## Quick Start

1. **Read G01** - Understand architecture and get checklist
2. **Follow G02** - Implement backend logic
3. **Follow G03** - Add configuration defaults
4. **Follow G04** - Create UI controls
5. **Follow G05** - Enable URL parameters
6. **Follow G06** - Test comprehensively

## Multi-Mode Support Principle

**CRITICAL**: By default, new parameters should work across ALL modes:
- Single backtest (long/short)
- Portfolio backtest
- Batch mode backtest

**This includes ALL layers:**
- Backend API and logic
- Frontend UI forms
- URL parameter encoding/decoding
- Configuration defaults
- Test coverage

**Only exclude a parameter from a mode if it fundamentally doesn't make sense there.**

## Real-World Example

See **Spec 45: Momentum-Based Trading** (`.kiro/specs/45_momentum-based-trading/`) for a complete implementation that follows all these guides:

**Parameters Added**: `momentumBasedBuy`, `momentumBasedSell` (booleans)

**Files Modified**:
- ✅ Backend: dcaExecutor.js, dcaBacktestService.js, server.js
- ✅ Config: backtestDefaults.json
- ✅ Frontend: DCABacktestForm.js, URLParameterManager.js
- ✅ Tests: test_momentum_mode.sh

**Result**: Complete parameter implementation with URL sharing, multi-mode support, and comprehensive testing.

## Common Mistakes (And How These Guides Help)

### Mistake 1: Parameter Dropped at API Layer
**Problem**: Parameter in req.body but undefined in service layer

**Solution**: G02 Step 3.2 explicitly warns about this and shows exact fix

### Mistake 2: Parameter Missing from URL
**Problem**: Parameter works but doesn't appear in shareable links

**Solution**: G05 provides complete URL encoding/decoding procedures

### Mistake 3: Incomplete Multi-Mode Support
**Problem**: Parameter only works in single backtest, not portfolio/batch

**Solution**: G01 and G06 emphasize multi-mode testing across all layers

### Mistake 4: Wrong Type Conversion
**Problem**: Percentages stored as whole numbers instead of decimals

**Solution**: G03 and G05 explain exact conversion patterns for each type

### Mistake 5: No Testing Strategy
**Problem**: Parameter appears to work but has edge case bugs

**Solution**: G06 provides comprehensive testing checklist and scripts

## Contributing to These Guides

When you discover new patterns or pitfalls while implementing parameters:

1. Update the relevant guide file
2. Add specific line references when possible
3. Include real code examples
4. Document the mistake and correct approach
5. Update checklists as needed

These guides should evolve as we learn more about the system.

## Questions or Issues?

If these guides don't cover your use case:

1. Check the real-world example (Spec 45)
2. Review recent parameter implementations for patterns
3. Add notes about your findings to improve the guides
4. Consider if your parameter requires mode-specific handling (and document why)

## Guide Maintenance

**Last Updated**: 2025-10-26
**Based On**: Spec 45 (Momentum-Based Trading) implementation
**Files**: 6 comprehensive guides (G01-G06)
**Coverage**: Complete parameter lifecycle from concept to deployment
