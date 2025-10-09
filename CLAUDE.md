# Claude Instructions

## Core Principles

### Critical Thinking & Partnership

- **Validate user requests first** - Check for mistakes or wrong assumptions before proceeding
- **Be critical and faithful to the truth** - Don't assume what the user asks is always valid
- **Act as a partner, not a yes-man** - Challenge assumptions when needed and provide honest feedback
- **Question unclear or potentially incorrect requests** - Help the user avoid mistakes

### Comprehensive Problem-Solving

When users report problems or errors, go beyond just fixing the immediate issue. Follow a comprehensive problem-solving approach.

## Problem and Bug Handling

When users report problems or errors:

### 1. Root Cause Analysis & Comprehensive Fixing

- **Fix the root cause**, not just the symptom
- **Find similar issues** in other parts of the codebase and fix them proactively
- **Identify technical debt** in related code and refactor to remove it
- **Identify improvement opportunities** for related features and implement them
- **Update all relevant documentation** to reflect the changes

### 2. Thorough Testing & Verification

- **Test extensively** to verify changes and ensure nothing breaks
- **For backend changes**: Use `curl` commands with appropriate URL parameters to verify
- **For frontend changes**: Use `curl` to test API endpoints and verify data flow
- **Use parallel testing**: Launch multiple Task agents in parallel to test different scenarios simultaneously
- **When uncertain**: Add debugging logs first, then use iterative testing (curl + logs approach)
- **Goal**: Eliminate the need for manual testing and log reporting from the user
- **Important**: If you can test with curl and get logs, do NOT ask the user to do it
- **Speed up testing**: Use Task tool with parallel agents to run multiple tests concurrently

### 3. Debugging Strategy

- If unclear or low confidence: Add comprehensive debugging logs
- Use combination of testing (curl commands) + logging to investigate iteratively
- **If you can test with curl and get logs, do it yourself** - don't ask the user
- Take time to be thorough - the goal is to save the user from manual testing

### 4. Task Management

- **Create a task list** for each problem or bug using TodoWrite
- **Mark tasks as done** when completed
- Keep the user informed of progress

### 5. Verification & Documentation

- **Always provide the exact URL/command** used to verify the fix
- If URL verification isn't possible:
  - Suggest changes to make it verifiable via URL
  - Provide alternative verification methods requiring minimal manual effort
- Make verification as automated as possible

### 6. Git Commit Strategy

- After fixing similar issues across the codebase, suggest git commits at optimal times
- Goal: Stage development properly and maintain good commit history
- Batch related fixes into logical commits

### 7. Autonomous Operation

- **Full permissions granted** - do as much as possible without asking
- Be proactive in fixing, testing, and verifying
- Only ask for clarification when the problem description is unclear

## Workflow Example

When a bug is reported:

1. **Analyze**: Identify root cause and related issues
2. **Plan**: Create task list with TodoWrite
3. **Fix**: Address root cause + similar issues + technical debt
4. **Test in Parallel**: Launch multiple Task agents to test different scenarios concurrently
   - Agent 1: Test backend endpoints with curl
   - Agent 2: Test frontend data flow
   - Agent 3: Test edge cases and error handling
   - Agent 4: Verify related functionality
5. **Debug**: Add logs if needed, iterate until confident
6. **Document**: Update relevant docs and provide verification URLs
7. **Commit**: Suggest git commit when appropriate

## Spec Creation Workflow

For problem fixes or new features:

1. **Auto-generate** requirements.md, design.md, and tasks.md without asking approval
2. **Proceed directly** to implementation after creating complete spec
3. **Only ask clarification** if problem description is unclear or missing critical information
4. **Create comprehensive specs** covering all aspects systematically

This streamlined approach enables faster problem resolution while maintaining systematic documentation.

### Spec Directory Naming Convention

All spec directories must be numbered sequentially:

- Format: `##_descriptive-name` (e.g., `01_algo-performance-calculation`, `16_ticker-specific-default-parameters`)
- Use two-digit zero-padded numbers (01, 02, ... 10, 11, etc.)
- Separate number from name with underscore
- Use kebab-case for descriptive names
- Check existing specs to determine the next available number
- Location: `.kiro/specs/`

## Parallel Task Strategy

Use Task tool with parallel agents for both **testing** and **information gathering**:

### When to Use Parallel Agents

**Testing (After Code Changes)**:

- Testing multiple endpoints simultaneously
- Verifying different parameter combinations
- Testing edge cases and error handling
- Cross-checking related functionality

**Research & Analysis (Answering Questions)**:

- Searching multiple parts of codebase simultaneously
- Analyzing different files/modules in parallel
- Comparing implementations across services
- Gathering information from multiple sources

### Example Usage

**Testing**:

```javascript
Task agent 1: "Test POST /api/backtest/dca with various parameters"
Task agent 2: "Test GET /api/stocks/:symbol/beta for multiple symbols"
Task agent 3: "Test batch backtest endpoint with edge cases"
```

**Research** (when user asks "how does X work?"):

```javascript
Task agent 1: "Search and analyze backend implementation of feature X"
Task agent 2: "Search and analyze frontend usage of feature X"
Task agent 3: "Find all configuration files related to feature X"
Task agent 4: "Search for tests and documentation of feature X"
```

**Benefits**:

- Faster feedback and response time
- More comprehensive coverage
- Parallel information gathering
- Reduced latency in answering complex questions

## Debugging Frontend URL Issues - Step-by-Step Guide

When a user reports a bug using a frontend URL (e.g., `http://localhost:3000/backtest/long/PLTR/results?...`), follow this systematic approach to investigate and fix the issue:

### Step 1: Capture the Real Backend API Call

**Goal**: Trace the actual parameters the backend receives after frontend conversion.

1. **Clear the server log** to start fresh:
   ```bash
   > /tmp/server_debug.log
   ```

2. **Ask user to access the frontend URL** (or do it yourself if server is running)
   - Frontend converts URL parameters (e.g., whole numbers → decimals)
   - Backend logs the actual API call with converted parameters

3. **Extract the backend API parameters** from server log:
   ```bash
   grep "Body Parameters:" /tmp/server_debug.log
   ```

### Step 2: Create Reproducible Test Script

**Goal**: Create a curl command that uses the EXACT parameters the backend received.

1. **Create/update `curl_test_command.sh`** with the backend API call:
   ```bash
   #!/bin/bash

   # Use REDUCED date range if full range produces too much data
   # Example: Use 2024-01-01 to 2025-01-01 instead of full range

   curl -X POST http://localhost:3001/api/backtest/dca \
     -H "Content-Type: application/json" \
     -d '{
       "symbol": "PLTR",
       "startDate": "2024-01-01",
       "endDate": "2025-01-01",
       # ... (copy EXACT parameters from server log)
     }' > /tmp/backtest_response.json

   # Extract daily transaction logs
   node -e "
   const fs = require('fs');
   const data = JSON.parse(fs.readFileSync('/tmp/backtest_response.json', 'utf8'));
   if (data.success && data.data.transactionLog) {
     data.data.transactionLog.forEach(line => console.log(line));
   }
   "
   ```

2. **Save to backend directory** for easy access:
   ```bash
   # Path: /Users/kweng/AI/DCA-Claude-Kiro-b4IncrementalGrid/backend/curl_test_command.sh
   chmod +x curl_test_command.sh
   ```

### Step 3: Run Test and Capture Transaction Logs

**Goal**: Get the detailed daily transaction logs that show the exact execution flow.

1. **Execute the test script**:
   ```bash
   ./curl_test_command.sh
   ```

2. **Search for the specific issue** the user reported:
   ```bash
   # Example: User reported issue at date 2024-08-08
   ./curl_test_command.sh 2>/dev/null | grep -A 5 -B 5 "2024-08-08"
   ```

3. **Look for patterns**:
   - Missing executions (order should execute but doesn't)
   - Wrong execution order (peaks updated before orders execute)
   - Unexpected cancellations
   - Silent disappearance of active orders

### Step 4: Verify the Bug with Evidence

**Goal**: Document the exact wrong behavior with concrete evidence.

1. **Extract relevant log entries** showing the bug:
   ```
   --- 2024-08-05 ---
   Price: 24.09   | Holdings: [21.87]
   ACTION: TRAILING STOP BUY UPDATED to 28.91

   --- 2024-08-08 ---
   Price: 29.28   | Holdings: [21.87]
   ACTION: TRAILING STOP SELL UPDATED  <-- BUY should have executed first!
   ```

2. **Identify what SHOULD have happened**:
   - Price 29.28 > BUY stop 28.91 → BUY should execute
   - But instead: SELL stop updated, BUY order disappeared

3. **Document in bug report**:
   - Show before/after state
   - Explain expected vs actual behavior
   - Include evidence from transaction logs

### Step 5: Trace Code Execution Flow

**Goal**: Find the root cause in the code.

1. **Locate the daily execution loop** in the service file
2. **Identify the execution order**:
   - What happens first? (e.g., SELL activation/update)
   - What happens second? (e.g., BUY execution check)
   - What happens last? (e.g., peak/bottom tracking update)

3. **Check for silent state changes**:
   - Orders being cancelled without logging
   - State variables being modified before execution checks
   - Peak/bottom updates affecting execution logic

4. **Use grep to trace specific functions**:
   ```bash
   grep -n "updatePeakBottomTracking\|checkTrailingStopBuyExecution\|updateTrailingStop" service.js
   ```

### Step 6: Create Bug Report

**Goal**: Provide clear evidence and analysis for the fix.

Include in the report:
1. **Evidence**: Exact log entries showing the bug
2. **Expected behavior**: What should happen
3. **Actual behavior**: What actually happens
4. **Root cause**: Code lines and execution order causing the issue
5. **Test script**: Path to `curl_test_command.sh` for reproduction

### Important Notes

- **Use REAL converted parameters** from server log, not frontend URL params
- **Reduce date ranges** if output is too large (test with 1 year instead of 4 years)
- **Always include transaction logs** - they show the exact execution flow
- **Don't guess** - trace actual parameters and execution flow
- **Save test scripts** for future regression testing

### Example Bug Investigation

**User Report**: "At price 29.28, BUY stop at 28.91 should execute but peaks update first"

**Investigation Steps**:
1. ✅ Captured backend API call from server log
2. ✅ Created `curl_test_command.sh` with exact parameters
3. ✅ Ran test, extracted transaction logs
4. ✅ Found evidence: Price 29.28 triggered SELL update, not BUY execution
5. ✅ Traced code: BUY check happens AFTER SELL update (wrong order)
6. ✅ Created bug report with evidence and root cause

**Result**: Clear understanding of the bug, ready for fix implementation.

## Testing Commands

### Backend Testing

```bash
# Test API endpoint
curl -X POST http://localhost:3001/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'

# Verify with logs
tail -f backend/logs/app.log
```

### Frontend Testing

```bash
# Test data flow
curl http://localhost:3001/api/data | jq '.'

# Verify API response format
curl -s http://localhost:3001/api/endpoint | jq '.data'
```

## Permissions

Claude has permission to:

- Run all commands without asking for approval
- Make code changes across the codebase
- Add debugging logs
- Run tests and verify fixes
- Commit changes when appropriate
- Refactor code to remove technical debt

## Commands

- **Lint**: `npm run lint` (if available)
- **Typecheck**: `npm run typecheck` (if available)
- **Backend restart**: Kill existing server on port 3001 and restart
- **Test**: Run curl commands to verify changes

## Important Reminders

- **Fix comprehensively**, not just the immediate issue
- **Test thoroughly** before claiming a fix is complete
- **Provide verification URLs** for every fix
- **Be proactive** in finding and fixing related issues
- **Document everything** including verification steps
- **Commit strategically** to maintain clean git history
- **Use TodoWrite** to track all tasks and progress
