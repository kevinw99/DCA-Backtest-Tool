# Generic Implementation Guides

## Overview

This directory contains comprehensive guides for implementing and verifying features in the DCA Backtest Tool. These guides document systematic processes learned from real-world implementations.

## Available Guides

### **G01: Adding New Parameters**
**Location**: `G01_adding-new-parameter/`

**What it covers:**
- Complete parameter implementation workflow
- 8 focused sections (overview, parameter relationships, unified handling, backend, configuration, frontend, URL, testing)
- Reference parameter designs (boolean and number types)
- Parameter relationship analysis framework
- Common pitfalls and patterns

**When to use**: Adding any new parameter (boolean, number, percentage, string) to the system

**Structure**:
```
G01_adding-new-parameter/
├── README.md                          # Main guide with navigation
├── 01-overview/                       # Architecture and checklist
├── 02-parameter-relationships/        # Analysis framework (CRITICAL - do this FIRST!)
├── 03-unified-handling/               # Principles for avoiding duplicate code
├── 04-backend/                        # Backend implementation
├── 05-configuration/                  # Configuration defaults
├── 06-frontend/                       # Frontend UI components
├── 07-url/                            # URL parameter handling
├── 08-testing/                        # Testing and verification
└── reference-parameters/              # Complete working examples
    ├── trailingBuyReboundPercent.md   # Number/percentage type reference
    └── enableConsecutiveIncrementalBuyGrid.md  # Boolean type reference
```

**Key Principle**: Follow existing parameter patterns. Don't create ad-hoc code. Analyze parameter relationships BEFORE implementing.

---

### **G02: Verifying Feature Implementation**
**Location**: `G02_verifying-feature-implementation/`

**What it covers:**
- Systematic verification methodology
- Portfolio backtest verification workflow
- Result validation techniques
- Troubleshooting guide for common issues
- Transaction log comparison
- Documentation requirements

**When to use**: Verifying any feature (not just parameters) works correctly across all modes

**Key Insight**: UI parameters don't prove functionality. Must verify complete data flow from frontend → backend → executor → results.

**Verification Phases**:
1. **Single Parameter Verification** - Backend curl + Frontend URL + DevTools inspection
2. **Portfolio Verification** - Frontend URL + Backend payload + Individual stock + Standalone comparison
3. **Result Validation** - Quantitative + Qualitative + Parameter echo checks
4. **Troubleshooting** - Missing parameters, same results, discrepancies
5. **Documentation** - Spec updates, code comments, test commands

**Case Study**: Discovered momentum parameters appearing in frontend URL but missing from backend payload, causing identical results regardless of parameter values.

---

## Recommended Workflow

### For Adding New Parameters

```
┌─────────────────────────────────────────────────┐
│ Step 1: Read G01 Main README                   │
│ Understand architecture and workflow            │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Step 2: Analyze Parameter Relationships (G01/02)│
│ ⚠️ CRITICAL: Do this BEFORE writing any code   │
│ - Create 3-column relationship table            │
│ - Identify conflicts and overrides              │
│ - Plan UI warnings/mutual exclusion             │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Step 3: Study Reference Parameters             │
│ - Boolean type: enableConsecutiveIncrementalBuyGrid │
│ - Number type: trailingBuyReboundPercent        │
│ - Follow EXACT same pattern                     │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Step 4: Implement (G01/03 - Unified Handling)  │
│ - Integrate into existing code paths            │
│ - Don't create ad-hoc special handling          │
│ - Use same helpers as existing parameters       │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Step 5: Follow Implementation Sections          │
│ - Backend (G01/04)                              │
│ - Configuration (G01/05)                        │
│ - Frontend (G01/06)                             │
│ - URL (G01/07)                                  │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Step 6: Verify with G02                        │
│ - Backend curl tests                            │
│ - Frontend URL tests                            │
│ - DevTools payload inspection                   │
│ - Portfolio verification workflow               │
│ - Result comparison                             │
└─────────────────────────────────────────────────┘
```

### For Verifying Features

```
┌─────────────────────────────────────────────────┐
│ Phase 1: Single Parameter Verification         │
│ 1. Test with curl (backend only)                │
│ 2. Test with frontend URL (full stack)          │
│ 3. Inspect DevTools (verify payload)            │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Phase 2: Portfolio Verification                 │
│ 1. Frontend URL test                            │
│ 2. Extract backend curl payload (DevTools)      │
│ 3. Individual stock result verification         │
│ 4. Standalone comparison (no capital constraints)│
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Phase 3: Result Validation                      │
│ 1. Quantitative checks (different counts/P/L)   │
│ 2. Transaction log analysis                     │
│ 3. Parameter echo verification                  │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Phase 4: Troubleshooting (if issues)            │
│ - Compare enabled vs disabled results           │
│ - Check backend payload for missing parameters  │
│ - Compare transaction logs line by line         │
│ - Disable capital optimization for baseline     │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Phase 5: Documentation                          │
│ - Update spec with verification commands        │
│ - Add code comments explaining behavior         │
│ - Document known edge cases                     │
└─────────────────────────────────────────────────┘
```

## Real-World Examples

### Example 1: Momentum-Based Trading (Spec 45)
**Parameters**: `momentumBasedBuy`, `momentumBasedSell` (boolean)

**Implementation**:
- ✅ Followed G01 for complete parameter integration
- ✅ Added to backend (executor, service, API)
- ✅ Added to configuration defaults
- ✅ Added to frontend UI (single + portfolio)
- ✅ Added to URL parameter manager
- ✅ Created test scripts

**Verification Challenge** (solved by G02):
- Frontend URL showed momentum parameters
- Backend payload was MISSING them
- Results were identical regardless of parameter values
- **Root Cause**: Portfolio page not including parameters in `handleSubmit`
- **Discovery Method**: DevTools inspection of POST request payload

**Lesson**: UI parameters don't prove functionality. Must verify complete data flow.

### Example 2: Consecutive Incremental Buy Grid (Spec 31)
**Parameter**: `enableConsecutiveIncrementalBuyGrid` (boolean)

**Implementation**:
- Used as reference parameter in G01
- Shows complete boolean integration pattern
- Demonstrates conditional UI (show/hide related params)
- Works across all modes (single, portfolio, batch)

**Verification**:
- Curl tests showed different grid spacing
- Transaction logs confirmed incremental behavior
- Portfolio results matched single stock backtests

## Multi-Mode Support Principle

**Default Assumption**: New parameters should work in ALL modes:
- Single backtest (long/short)
- Portfolio backtest
- Batch mode backtest

**This includes ALL layers**:
- Backend API endpoints and logic
- Frontend UI forms
- URL parameter encoding/decoding
- Configuration defaults
- API curl commands
- Test coverage

**Only exclude from a mode if**:
- Fundamentally doesn't make sense (e.g., portfolio-level param in single backtest)
- Creates logical conflicts (e.g., batch-specific parallelization)
- Requires mode-specific implementation

## Common Mistakes (And Which Guide Helps)

### Mistake 1: Not Analyzing Parameter Relationships First
**Problem**: Parameter conflicts with existing parameters, confusing users
**Solution**: G01/02 - Parameter Relationships framework (3-column table analysis)

### Mistake 2: Creating Ad-Hoc Code
**Problem**: Special handling just for this parameter, duplicate code paths
**Solution**: G01/03 - Unified Handling principles (integrate into existing patterns)

### Mistake 3: Parameter Dropped at API Layer
**Problem**: Parameter in req.body but undefined in service layer
**Solution**: G01/04 - Backend implementation (explicit parameter passing in server.js)

### Mistake 4: Parameter Missing from URL
**Problem**: Parameter works but doesn't appear in shareable links
**Solution**: G01/07 - URL parameter handling (encoding/decoding procedures)

### Mistake 5: UI Shows Parameter But Backend Doesn't Receive It
**Problem**: Checkbox visible, URL includes it, but backend payload doesn't
**Solution**: G02 - Verification (DevTools inspection reveals missing payload fields)

### Mistake 6: Incomplete Multi-Mode Support
**Problem**: Works in single backtest but not portfolio/batch
**Solution**: G01 emphasizes multi-mode by default + G02 portfolio verification workflow

### Mistake 7: Same Results Regardless of Parameter Value
**Problem**: Feature appears to work but has no effect
**Solution**: G02 - Result validation (compare enabled vs disabled, transaction log analysis)

## Key Principles

### 1. Analyze Before Implementing (G01/02)
Create parameter relationship table BEFORE writing code to prevent conflicts and bugs.

### 2. Mimic, Don't Innovate (G01/03)
Follow existing parameter patterns. Don't create new code paths. Use reference parameters as templates.

### 3. Verify Complete Data Flow (G02)
Don't trust UI alone. Verify: Frontend → URL → Backend Payload → Service → Executor → Results

### 4. Test Multi-Mode by Default (G01 + G02)
Always test single, portfolio, and batch modes unless parameter is mode-specific.

### 5. Compare Enabled vs Disabled (G02)
Always test BOTH states. If results are identical, feature isn't working.

## Integration with Spec Template

When creating a spec:

**requirements.md**:
- Document parameter relationships (what it affects, what contradicts it)
- Document parameter behavior (enabled vs disabled)
- Document special cases and edge conditions

**design.md**:
- Reference G01 for implementation approach
- Document data flow through all layers
- Explain any deviations from standard patterns

**testing.md**:
- Include G02 verification commands (curl tests, frontend URLs)
- Document expected result differences
- Provide transaction log examples showing feature in action

## Contributing to These Guides

When discovering new patterns or pitfalls:

1. **Update the relevant guide** with specific findings
2. **Add file location references** (line numbers if possible)
3. **Include real code examples** from the codebase
4. **Document the mistake and correct approach**
5. **Update checklists** with new verification steps
6. **Add to troubleshooting sections** if debugging was required

These guides should evolve with the project.

## Guide Maintenance

**Last Updated**: 2025-10-26
**Coverage**: 2 comprehensive guides (G01 with 8 sections, G02)
**Based On**:
- Spec 45 (Momentum-Based Trading)
- Spec 31 (Consecutive Incremental Buy Grid)
- Real-world bug discovery and verification processes

**Future Additions**:
- G03: Performance optimization patterns
- G04: Error handling and validation
- G05: UI/UX best practices
- (Add new guides as patterns emerge)

## Summary

**G01** tells you **HOW to implement** a parameter correctly across all layers.

**G02** tells you **HOW to verify** it actually works (because UI alone doesn't prove functionality).

Together, they ensure:
- ✅ Complete implementation (no missing steps)
- ✅ No duplicate code (unified handling)
- ✅ No silent failures (proper verification)
- ✅ Multi-mode support (works everywhere)
- ✅ Maintainable code (follows patterns)
