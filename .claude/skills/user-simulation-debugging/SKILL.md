---
name: user-simulation-debugging
description: Use after implementing fixes or new features, before declaring success - ensures changes work by testing exactly as the user would, catching configuration errors, path issues, and integration problems that look correct in code but fail in practice
version: 1.0.0
last_updated: 2025-11-25
changelog: |
  v1.0.0 (2025-11-25): Initial creation based on MCP server integration debugging lessons
---

# User Simulation Debugging Methodology

## When to Use This Skill

Use this skill **AFTER** implementing ANY of the following:

1. **Bug fixes** - Before claiming the bug is fixed
2. **New features** - Before declaring feature complete
3. **Configuration changes** - After modifying any config files
4. **Integration work** - After connecting systems/services
5. **Deployment setup** - After preparing deployment configs
6. **Environment changes** - After updating dependencies or paths

**DO NOT skip this skill even if the code "looks correct"** - many bugs only appear when running in the actual user environment.

## Core Principle

> **"For verifying a fix or new feature, always try running the steps as the user would manually do it, then identify gaps, and fix them."**

The key insight: **Code that looks correct in your editor may fail in practice due to:**

- Wrong file paths (relative vs absolute)
- Wrong config file locations
- Wrong executable paths (system vs venv)
- Environment variables not set
- Services not restarted to pick up changes
- Permissions issues
- Missing dependencies in user's environment

## The Recursive Debugging Process

This is an **iterative, recursive process**. Each cycle reveals new gaps:

```
1. Manually test as user would
2. Identify what went wrong
3. Fix the identified issues
4. Go back to step 1 (test again as user would)
5. Repeat until everything works end-to-end
```

**IMPORTANT**: Don't stop after one fix. Keep testing and fixing until the entire workflow works.

## Mandatory Checklist

Create TodoWrite todos for EACH item below:

### Phase 1: Identify User's Actual Workflow

- [ ] **Document exact commands/steps user will run**
  - If it's a CLI tool: What exact command?
  - If it's a service: How does it start?
  - If it's a config: Which application reads it?

- [ ] **Identify all file paths involved**
  - Config files: Where does the application look for them?
  - Executables: Which Python/Node/binary will be used?
  - Data files: Where does the app expect to find them?

- [ ] **Identify environment requirements**
  - Environment variables: Which are needed?
  - Working directory: Does it matter where command runs from?
  - Dependencies: Are all required packages/modules available?

### Phase 2: Test Exactly As User Would

- [ ] **Run the exact command user will run**
  - Use the exact paths they would use
  - Run from the directory they would run from
  - Use the same environment they would have
  - **DO NOT** use shortcuts like `source venv/bin/activate` if user won't do that

- [ ] **Monitor all outputs and logs**
  - Standard output/error
  - Log files (find their location first)
  - System logs (if applicable)
  - Application-specific logs

- [ ] **Test the full end-to-end flow**
  - Don't just test startup - test actual functionality
  - Test with real inputs/parameters
  - Verify expected outputs are produced

### Phase 3: Verify Changes Take Effect

- [ ] **Confirm config changes are loaded**
  - Check logs for evidence of new config
  - Verify old config isn't being cached
  - Restart services if needed to pick up changes

- [ ] **Confirm new code is executed**
  - Add temporary debug logs if needed
  - Verify old code isn't running from cache
  - Check timestamps on files

- [ ] **Confirm environment is correct**
  - Print environment variables to verify
  - Check which executable is running (full path)
  - Verify working directory is as expected

### Phase 4: Recursive Gap Identification

- [ ] **Document what failed**
  - Exact error messages
  - Which step failed
  - What was expected vs actual

- [ ] **Identify root cause**
  - Why did it fail?
  - What assumption was wrong?
  - What configuration was incorrect?

- [ ] **Fix all related issues**
  - Fix the immediate problem
  - Look for similar issues elsewhere
  - Update documentation if needed

- [ ] **Return to Phase 2** (test again as user would)
  - Repeat until no failures

## Real-World Example: MCP Server Integration

### Context
Implemented an MCP server for DCA Backtest Tool. Code looked correct. Config file was created. But it didn't work.

### Error A: Wrong Config File Location

**What I did wrong**:
- Created config at `~/.config/claude-code/mcp_config.json`
- Assumed this was correct without verifying

**What I should have done**:
- **Before creating config**: Look up where Claude Desktop actually reads config from
- **Test command**: `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json`
- **Would have discovered**: Correct location is `~/Library/Application Support/Claude/claude_desktop_config.json`

**User simulation test that would have caught this**:
```bash
# 1. Check where Claude Desktop looks for config
ls -la ~/Library/Application\ Support/Claude/

# 2. Verify my config is in that file
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep dca-backtest

# 3. Would have found: Config entry doesn't exist!
```

### Error B: Wrong Python Executable Path

**What I did wrong**:
- Used `"command": "python3.11"` in config
- Assumed system Python would have packages
- Didn't test if this command actually works

**What I should have done**:
- **Test the exact command from config**:
  ```bash
  # Try running with the command I put in config
  python3.11 /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py

  # Output: ModuleNotFoundError: No module named 'fastmcp'
  # Caught the bug!
  ```

- **Fix to use venv path**:
  ```bash
  /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/venv/bin/python
  ```

- **Verify the fix works**:
  ```bash
  /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/venv/bin/python \
    /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py

  # Should see: Server starting up successfully
  ```

### Complete User Simulation Test That Would Have Caught Both Errors

```bash
# Step 1: Find the config file Claude Desktop actually uses
echo "Looking for Claude Desktop config..."
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Step 2: Check if my MCP server is configured there
echo "Checking if dca-backtest is in config..."
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep -A 10 dca-backtest

# Step 3: Extract the exact command and args from config
echo "Testing the command specified in config..."
COMMAND=$(cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq -r '.mcpServers["dca-backtest"].command')
ARGS=$(cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq -r '.mcpServers["dca-backtest"].args[0]')

# Step 4: Run the exact command Claude Desktop will run
echo "Running: $COMMAND $ARGS"
$COMMAND $ARGS

# Step 5: Check for errors
if [ $? -eq 0 ]; then
  echo "SUCCESS: MCP server starts correctly"
else
  echo "FAILURE: MCP server failed to start"
  echo "Checking logs..."
  ls -la ~/Library/Logs/Claude/
  tail -50 ~/Library/Logs/Claude/mcp-server-dca-backtest.log
fi
```

**This test would have revealed**:
1. Config file doesn't exist at expected location (Error A)
2. `python3.11` command fails with module error (Error B)
3. Both issues caught **before** user reported them

### Recursive Fix-and-Test Cycle

**First iteration**:
```bash
# Test 1: Run command from config
python3.11 mcp_server.py
# Result: ModuleNotFoundError
# Gap identified: Using system Python, not venv Python
```

**Fix 1**: Update config to use venv path

**Second iteration**:
```bash
# Test 2: Run updated command
/path/to/venv/bin/python mcp_server.py
# Result: Success! Server starts
# Gap identified: Need to verify this config is in correct location
```

**Fix 2**: Move config to correct location

**Third iteration**:
```bash
# Test 3: Verify config is loaded by Claude Desktop
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep dca-backtest
# Result: Config found!
# Gap identified: Need to verify Claude Desktop picks up changes
```

**Fix 3**: Restart Claude Desktop

**Fourth iteration**:
```bash
# Test 4: Check logs after Claude Desktop restart
tail -50 ~/Library/Logs/Claude/mcp-server-dca-backtest.log
# Result: All 9 tools registered successfully
# No gaps found - DONE!
```

## Common Gaps to Look For

### Configuration Gaps

- [ ] Config file in wrong location
- [ ] Config file syntax errors (missing commas, quotes, etc.)
- [ ] Config not picked up (service needs restart)
- [ ] Multiple config files (using wrong one)
- [ ] Environment-specific config overrides

### Path Gaps

- [ ] Relative paths that break depending on working directory
- [ ] Hardcoded paths that don't exist on user's system
- [ ] System executable vs venv executable (python, node, etc.)
- [ ] Missing intermediate directories
- [ ] Wrong file permissions

### Environment Gaps

- [ ] Missing environment variables
- [ ] Wrong Python/Node version
- [ ] Missing system dependencies
- [ ] Virtual environment not activated
- [ ] Wrong working directory

### Integration Gaps

- [ ] Service not running (backend API, database, etc.)
- [ ] Port conflicts
- [ ] Firewall/network issues
- [ ] Authentication/credentials not configured
- [ ] API version mismatches

## When NOT to Use This Skill

- **During initial development** - Use TDD and other development skills first
- **For simple code changes** - If change is pure logic with no external dependencies
- **Before running tests** - Run automated tests first, use this for integration verification

## Anti-Patterns (What NOT to Do)

❌ **"The code looks correct, so it must work"**
- Code correctness ≠ correct integration

❌ **"I'll test it in my development environment"**
- Your environment ≠ user's environment

❌ **"I'll just check the logs later if there's an issue"**
- Check logs NOW, as part of verification

❌ **"The user can test it and report back"**
- Don't make user your QA - test yourself first

❌ **"I fixed one issue, we're done"**
- First issue fixed often reveals second issue - keep testing recursively

## Summary: The 6-Step Recursive Process

1. **Identify user's workflow** - What exact commands/steps will they run?
2. **Run those exact commands yourself** - Use their paths, their environment
3. **Monitor all outputs and logs** - Find where logs are written
4. **Identify gaps** - What failed? What assumption was wrong?
5. **Fix the gaps** - Update code, config, paths, environment
6. **Go back to step 2** - Test again until everything works

**Each iteration reveals new information. Don't stop until the entire workflow succeeds end-to-end.**

## Integration with Other Skills

- **Use AFTER** `test-driven-development` - TDD ensures unit correctness, this ensures integration correctness
- **Use AFTER** `systematic-debugging` - Systematic debugging finds code bugs, this finds environment/config bugs
- **Use BEFORE** `requesting-code-review` - Don't request review until you've verified it works as user would use it
- **Use WITH** `root-cause-tracing` - If user simulation reveals bugs, use root cause tracing to understand why

## Skill Checklist Summary

When you use this skill, create TodoWrite todos for:

1. [ ] Document exact user workflow (commands, paths, environment)
2. [ ] Run exact commands user would run (no shortcuts)
3. [ ] Monitor all outputs and logs (find log locations first)
4. [ ] Verify config changes take effect (restart services if needed)
5. [ ] Identify gaps from test results (what failed and why)
6. [ ] Fix all identified gaps (immediate + related issues)
7. [ ] Return to step 2 (recursive testing until success)

**Remember**: This is recursive. Each fix may reveal new gaps. Keep iterating until full end-to-end success.
