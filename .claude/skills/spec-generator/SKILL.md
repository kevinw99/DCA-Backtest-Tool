---
name: spec-generator
description: Generate comprehensive spec documentation (requirements.md, design.md, tasks.md) for new features or bug fixes. Use when starting new work, adding features, or fixing complex bugs. Automatically creates numbered spec directories following project conventions.
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

## G01 Compliance (For Parameters)

If adding a new parameter, ensure G01 compliance:

1. **Multi-mode support**: Single, Portfolio, Batch
2. **Components per mode**:
   - Backend service
   - Frontend UI
   - Frontend state
   - API request payload
   - URL parameters (single/portfolio only)

3. **Check G01 guidelines**: `.kiro/specs/generic/G01_adding-new-parameter/`

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
