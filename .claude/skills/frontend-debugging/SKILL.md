---
name: frontend-debugging
description: Use when debugging frontend issues, visual bugs, JavaScript errors, or React component problems. Leverages Chrome DevTools MCP for browser automation and inspection.
---

# Frontend Debugging with Chrome DevTools MCP

## When to Use This Skill

Use this skill when:
- User reports a visual bug or UI issue
- JavaScript console errors need investigation
- React component state needs inspection
- Network requests need analysis
- DOM elements need examination
- Performance profiling is needed

## Prerequisites

Chrome must be running with remote debugging enabled:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Or on Linux:
```bash
google-chrome --remote-debugging-port=9222
```

## Available MCP Tools

The Chrome DevTools MCP provides these tools:

### Navigation & Pages
- `mcp__chrome-devtools__list_tabs` - List all open browser tabs
- `mcp__chrome-devtools__navigate` - Navigate to a URL
- `mcp__chrome-devtools__click` - Click on elements
- `mcp__chrome-devtools__type` - Type text into inputs

### Inspection
- `mcp__chrome-devtools__get_console_logs` - Get JavaScript console output
- `mcp__chrome-devtools__evaluate` - Execute JavaScript in the page
- `mcp__chrome-devtools__screenshot` - Capture page screenshots
- `mcp__chrome-devtools__get_page_content` - Get HTML content

### Network
- `mcp__chrome-devtools__network_get_response_body` - Get network response bodies
- `mcp__chrome-devtools__network_get_all_requests` - List all network requests

## Debugging Workflow

### Step 1: Ensure Chrome is Running with Debug Port

Ask the user to launch Chrome with:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Or check if already running:
```bash
lsof -i :9222
```

### Step 2: List Available Tabs
```
Use mcp__chrome-devtools__list_tabs to see open pages
```

### Step 3: Navigate to Problem Page
```
Use mcp__chrome-devtools__navigate with the frontend URL
```

### Step 4: Investigate Based on Issue Type

**For JavaScript Errors:**
1. `mcp__chrome-devtools__get_console_logs` - Check for errors
2. `mcp__chrome-devtools__evaluate` - Run diagnostic scripts

**For Visual/Layout Issues:**
1. `mcp__chrome-devtools__screenshot` - Capture current state
2. `mcp__chrome-devtools__evaluate` - Query DOM elements
3. `mcp__chrome-devtools__get_page_content` - Get HTML structure

**For Network/API Issues:**
1. `mcp__chrome-devtools__network_get_all_requests` - List API calls
2. `mcp__chrome-devtools__network_get_response_body` - Inspect responses

**For React State Issues:**
```javascript
// Use evaluate to inspect React state
mcp__chrome-devtools__evaluate({
  expression: `
    const root = document.getElementById('root');
    const fiber = root._reactRootContainer?._internalRoot?.current;
    // Navigate fiber tree to find component state
  `
})
```

### Step 5: Document Findings

After investigation, document:
- Console errors found
- Network failures
- DOM state issues
- Screenshots of visual bugs

## Example Investigation

User reports: "The backtest results page shows blank after clicking submit"

```
1. mcp__chrome-devtools__list_tabs → Find the React app tab
2. mcp__chrome-devtools__navigate → Go to the results page URL
3. mcp__chrome-devtools__get_console_logs → Check for errors
4. mcp__chrome-devtools__network_get_all_requests → Check API calls
5. mcp__chrome-devtools__screenshot → Capture current state
6. mcp__chrome-devtools__evaluate → Query React state or DOM
```

## Limitations

- Chrome must be launched with `--remote-debugging-port=9222`
- Cannot inspect service workers directly
- Limited access to browser extensions
- Some security-sensitive pages may be restricted

## Fallback

If Chrome DevTools MCP is unavailable:
1. Use curl to test backend APIs directly
2. Ask user to check browser console manually
3. Add console.log statements to frontend code
4. Use the webapp-testing skill with Playwright as alternative
