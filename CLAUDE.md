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
