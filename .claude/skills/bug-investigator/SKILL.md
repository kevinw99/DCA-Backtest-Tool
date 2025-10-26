---
name: bug-investigator
description: Systematically investigate DCA backtest bugs using server logs, curl tests, and transaction log analysis. Use when user reports bugs, unexpected behavior, or issues with frontend URLs or API endpoints. Follows the comprehensive debugging workflow from CLAUDE.md.
version: 1.0.0
last_updated: 2025-10-26
changelog: |
  v1.0.0 (2025-10-26): Initial creation
---

# Bug Investigator Skill

This skill implements the systematic bug investigation workflow for the DCA Backtest Tool.

## When to Use This Skill

Use this skill when:
- User reports a bug with a frontend URL
- Unexpected behavior in backtest results
- API endpoints returning wrong data
- Transaction execution order issues
- Missing or incorrect trades

## Investigation Workflow

### Step 1: Capture Real Backend API Call

1. **Clear server log**:
   ```bash
   > /tmp/server_debug.log
   ```

2. **Ask user to access the frontend URL** (or reproduce yourself)

3. **Extract backend parameters** from log:
   ```bash
   grep "Body Parameters:" /tmp/server_debug.log
   ```

### Step 2: Create Reproducible Test Script

Create `backend/curl_test_command.sh` with:
- EXACT parameters from server log (not frontend URL params)
- REDUCED date range if output is too large (e.g., 1 year instead of 4)
- Extract transaction logs for analysis

**Template**:
```bash
#!/bin/bash

curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SYMBOL",
    "startDate": "2024-01-01",
    "endDate": "2025-01-01",
    # ... exact parameters from server log
  }' > /tmp/backtest_response.json

# Extract transaction logs
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/backtest_response.json', 'utf8'));
if (data.success && data.data.transactionLog) {
  data.data.transactionLog.forEach(line => console.log(line));
}
"
```

### Step 3: Run Test and Capture Evidence

1. **Execute test**:
   ```bash
   chmod +x backend/curl_test_command.sh
   ./backend/curl_test_command.sh
   ```

2. **Search for specific issue**:
   ```bash
   ./backend/curl_test_command.sh 2>/dev/null | grep -A 5 -B 5 "DATE"
   ```

3. **Look for patterns**:
   - Missing executions
   - Wrong execution order
   - Unexpected cancellations
   - Silent state changes

### Step 4: Document Evidence

Extract log entries showing:
- **Before state**: What was supposed to happen
- **After state**: What actually happened
- **Expected behavior**: What should have happened
- **Actual behavior**: What the code did

### Step 5: Trace Code Execution

1. Locate daily execution loop in service file
2. Identify execution order
3. Check for silent state changes
4. Use grep to trace functions:
   ```bash
   grep -n "functionName\|anotherFunction" service.js
   ```

### Step 6: Create Bug Report

Include:
1. ✅ Evidence: Exact log entries
2. ✅ Expected behavior
3. ✅ Actual behavior
4. ✅ Root cause analysis
5. ✅ Path to test script for reproduction

## Important Notes

- **Use REAL converted parameters** from server log, not frontend URL params
- **Reduce date ranges** if output is too large
- **Always include transaction logs** - they show exact execution flow
- **Don't guess** - trace actual parameters and execution flow
- **Save test scripts** for regression testing

## After Investigation

Once root cause is identified:
1. Fix the issue comprehensively (not just the symptom)
2. Find and fix similar issues in the codebase
3. Add tests to prevent regression
4. Update documentation if needed
