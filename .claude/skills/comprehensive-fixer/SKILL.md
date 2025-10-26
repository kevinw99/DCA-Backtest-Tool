---
name: comprehensive-fixer
description: Fix bugs comprehensively by addressing root cause, finding similar issues across codebase, removing technical debt, and testing thoroughly. Use when user reports bugs or when code issues are discovered. Implements the comprehensive problem-solving approach from CLAUDE.md.
---

# Comprehensive Fixer Skill

Implements comprehensive bug fixing that goes beyond just patching symptoms.

## When to Use This Skill

Use this skill when:
- User reports a bug or error
- Tests reveal unexpected behavior
- Code review identifies issues
- Technical debt needs addressing
- Similar issues exist across codebase

## Comprehensive Fixing Approach

Based on CLAUDE.md principles:

### 1. Root Cause Analysis

**Don't just fix symptoms** - find the underlying issue:

1. **Trace execution flow**: Understand how the bug occurs
2. **Identify the root cause**: What's the fundamental problem?
3. **Ask "why?"** multiple times until reaching the core issue

**Example**:
- ❌ Symptom: "Order not executing at expected price"
- ✅ Root Cause: "Peak tracking updates before order execution check"

### 2. Find Similar Issues

**Proactively fix related problems**:

1. **Search codebase** for similar patterns:
   ```bash
   grep -r "problematicPattern" backend/services/
   grep -r "similarFunction" frontend/src/
   ```

2. **Check all modes**: If bug exists in single mode, check portfolio and batch

3. **Review related features**: If buy logic has issue, check sell logic

**Example**:
If trailing buy has execution order bug, check:
- Trailing sell execution order
- Grid buy/sell execution order
- Portfolio mode execution order

### 3. Remove Technical Debt

**Clean up related code**:

1. **Refactor duplicated code** into shared functions
2. **Add missing error handling**
3. **Improve variable names** for clarity
4. **Add logging** for debugging
5. **Remove dead code**

### 4. Testing Strategy

**Test thoroughly before claiming done**:

#### Test the Fix
```bash
# Create test script for reproduction
./test_script.sh

# Verify fix resolves issue
# Check edge cases
# Test error conditions
```

#### Test Related Functionality
```bash
# Ensure fix didn't break other features
# Test all three modes (single, portfolio, batch)
# Test with different parameter combinations
```

#### Parallel Testing
Use Task tool to run multiple tests concurrently:
```javascript
Task agent 1: "Test single mode with fix"
Task agent 2: "Test portfolio mode with fix"
Task agent 3: "Test batch mode with fix"
Task agent 4: "Test edge cases and error handling"
```

### 5. Verification URLs

**Always provide verification commands**:

**Backend verification**:
```bash
curl -X POST http://localhost:3001/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}' | jq '.'
```

**Frontend verification**:
```
http://localhost:3000/backtest?symbol=AAPL&param=value
```

### 6. Documentation Updates

**Update relevant docs**:

1. **API docs** if endpoint behavior changed
2. **User guides** if feature behavior changed
3. **Code comments** for complex logic
4. **CHANGELOG.md** with fix description

### 7. Git Commit Strategy

**Commit strategically**:

1. **Batch related fixes** into logical commits
2. **Use conventional commit format**:
   ```
   fix(component): Brief description

   - Root cause: Explanation
   - Fix applied: What was changed
   - Similar issues fixed: List of related fixes
   - Tests added: Verification approach
   ```

3. **Commit at natural breakpoints**:
   - After fixing root cause
   - After fixing similar issues
   - After testing verification

## Workflow Example

### Bug Report:
"Trailing buy order at $28.91 not executing when price reaches $29.28"

### Step 1: Investigate
- Create curl test with exact parameters
- Extract transaction logs
- Find evidence: Peak update happens before order execution

### Step 2: Root Cause
**Found**: Execution order in daily loop:
```javascript
// ❌ WRONG ORDER
updatePeakTracking();  // Clears buy order
checkBuyExecution();   // Too late - order gone

// ✅ CORRECT ORDER
checkBuyExecution();   // Execute first
updatePeakTracking();  // Then update tracking
```

### Step 3: Find Similar Issues
Search for similar patterns:
```bash
grep -n "updatePeakTracking\|checkExecution" backend/services/*.js
```

Found same issue in:
- Portfolio backtest service
- Short strategy logic
- Sell execution order

### Step 4: Fix All Issues
Fix root cause + 3 similar issues in one comprehensive change

### Step 5: Test
Create tests for:
- Original bug scenario ✅
- Portfolio mode ✅
- Short strategy ✅
- Sell execution ✅

### Step 6: Document
- Update transaction log documentation
- Add code comments explaining execution order
- Create test scripts for regression

### Step 7: Commit
```bash
git commit -m "fix(executor): Fix execution order to check orders before peak updates

Root cause: Peak tracking was clearing trailing orders before execution check

Fixes:
- Single backtest trailing buy execution
- Portfolio backtest execution order
- Short strategy execution order
- Sell order execution timing

Tests: Added curl test scripts for all scenarios
"
```

## Task Management

Use TodoWrite to track comprehensive fixing:

```javascript
TodoWrite({
  todos: [
    { content: "Investigate bug and find root cause", status: "in_progress" },
    { content: "Fix root cause in main service", status: "pending" },
    { content: "Find and fix similar issues in portfolio mode", status: "pending" },
    { content: "Find and fix similar issues in short strategy", status: "pending" },
    { content: "Refactor duplicated execution logic", status: "pending" },
    { content: "Create test scripts for all scenarios", status: "pending" },
    { content: "Run parallel tests to verify fixes", status: "pending" },
    { content: "Update documentation", status: "pending" },
    { content: "Create git commit", status: "pending" }
  ]
});
```

## Key Principles

1. ✅ **Fix root cause, not symptoms**
2. ✅ **Find and fix similar issues proactively**
3. ✅ **Remove technical debt in related code**
4. ✅ **Test thoroughly - use parallel agents**
5. ✅ **Provide verification URLs/commands**
6. ✅ **Update documentation**
7. ✅ **Commit strategically**
8. ✅ **Save user from manual testing**

## What Makes a Fix "Comprehensive"

❌ **Surface Fix**:
- Patches one instance of the bug
- No testing
- No related issue search
- No documentation

✅ **Comprehensive Fix**:
- Addresses root cause
- Fixes all similar instances
- Includes thorough tests
- Updates documentation
- Removes related technical debt
- Provides verification commands
- Strategic git commit

## Reference

- CLAUDE.md: Problem and Bug Handling section
- CLAUDE.md: Comprehensive Problem-Solving section
