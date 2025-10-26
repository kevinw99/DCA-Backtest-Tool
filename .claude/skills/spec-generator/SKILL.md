---
name: spec-generator
description: Generate comprehensive spec documentation (requirements.md, design.md, tasks.md) for new features or bug fixes. Use when starting new work, adding features, or fixing complex bugs. Automatically creates numbered spec directories following project conventions.
version: 1.1.0
last_updated: 2025-10-26
changelog: |
  v1.1.0 (2025-10-26): Emphasize G01 compliance for parameters, add verification-first phase
  v1.0.0 (2025-10-26): Initial creation
---

# Spec Generator Skill

Generates comprehensive specification documents for new features or bug fixes following the project's .kiro/specs/ structure.

## When to Use This Skill

Use this skill when:
- Starting a new feature implementation
- Fixing complex bugs that need documentation
- Adding new parameters or capabilities
- User requests a new feature
- Major refactoring or architectural changes

## Spec Directory Structure

All specs go in `.kiro/specs/` with format: `##_descriptive-name/`

Example: `.kiro/specs/45_momentum-based-trading/`

## Required Files

Every spec must contain:

### 1. requirements.md

**Contents**:
- Problem statement
- Current limitations
- Proposed solution
- Functional requirements (FR-1, FR-2, etc.)
- Non-functional requirements
- Success criteria
- Out of scope items

### 2. design.md

**Contents**:
- Architecture overview
- Component analysis (what needs to change)
- Current state vs target state
- Data flow diagrams
- API changes
- Database schema changes (if applicable)
- Implementation approach
- Phase breakdown

### 3. tasks.md

**Contents**:
- Detailed task breakdown by phase
- Time estimates for each task
- Dependencies between tasks
- Acceptance criteria per task
- Testing requirements
- Documentation requirements

## Spec Numbering Convention

1. Check existing specs to find next number:
   ```bash
   ls .kiro/specs/ | grep -E "^[0-9]+" | sort -n | tail -1
   ```

2. Use two-digit zero-padded numbers: `01`, `02`, ..., `45`, `46`

3. Use kebab-case for descriptive names:
   - Good: `45_momentum-based-trading`
   - Bad: `45_MomentumBasedTrading` or `45_momentum_based_trading`

## Workflow

1. **Analyze request**: Understand what needs to be built/fixed

2. **Create spec directory**:
   ```bash
   mkdir -p .kiro/specs/##_feature-name/
   ```

3. **Generate requirements.md**:
   - Start with problem statement
   - Document current limitations
   - Define proposed solution
   - List functional requirements

4. **Generate design.md**:
   - Analyze affected components
   - Document current vs target state
   - Break down into phases
   - Include code examples

5. **Generate tasks.md**:
   - Break design into actionable tasks
   - Estimate time per task
   - Define acceptance criteria
   - Plan testing approach

6. **Proceed directly to implementation** unless critical information is missing

## G01 Compliance (For Parameters) - CRITICAL

⚠️ **If adding a parameter, START WITH VERIFICATION** (Lesson from Spec 46)

### Verification-First Approach

**Before implementation, create verification phase**:

1. **Phase 0: Verification** (1-2 hours)
   - Check what already exists
   - Document gaps
   - Create `verification-findings.md`
   - Estimate actual work needed

**Why this matters**: Spec 46 estimated 9-15 hours but only needed 1.5 hours because verification revealed backend was already complete.

### G01 Compliance Requirements

If adding a new parameter, the spec MUST include:

1. **Multi-mode support**: Single, Portfolio, Batch
2. **Components per mode**:
   - Backend service (may already exist!)
   - Frontend UI (may exist but disconnected!)
   - Frontend state (**TWO states for batch mode**)
   - API request payload (separate for batch mode)
   - URL parameters (single/portfolio only)

3. **Batch Mode Critical Checks**:
   - ✅ `batchParameters` default state updated
   - ✅ Batch request payload includes parameter
   - ✅ Not just `parameters` state (common mistake)

4. **Check G01 guidelines**: `.kiro/specs/generic/G01_adding-new-parameter/`

### G01 Compliance Spec Template

```markdown
## G01 Multi-Mode Compliance Status

| Component | Single | Portfolio | Batch | Notes |
|-----------|--------|-----------|-------|-------|
| Backend Service | ✅ | ✅ | ❌ | Batch missing parameter |
| Frontend UI | ✅ | ✅ | ✅ | Checkboxes exist |
| Frontend State | ✅ | ✅ | ❌ | batchParameters missing |
| API Request | ✅ | ✅ | ❌ | Batch payload missing |
| URL Parameters | ✅ | ✅ | N/A | Batch doesn't use URLs |

**Compliance**: ❌ Partial - Batch mode incomplete
```

## Best Practices

- ✅ **Auto-generate** all three files without asking approval
- ✅ **Be comprehensive** - include all details
- ✅ **Be specific** - provide code examples where helpful
- ✅ **Estimate realistically** - break large tasks into smaller chunks
- ✅ **Plan for testing** - include verification steps
- ✅ **Document decisions** - explain why approach was chosen

## After Spec Creation

1. Present spec summary to user
2. Proceed directly to implementation (per CLAUDE.md)
3. Use TodoWrite to track implementation tasks
4. Reference spec in git commit messages
