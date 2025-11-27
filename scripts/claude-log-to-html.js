#!/usr/bin/env node
/**
 * Convert Claude Code terminal output to styled HTML
 *
 * Usage:
 *   node claude-log-to-html.js input.txt > output.html
 *   cat session.log | node claude-log-to-html.js > output.html
 *   pbpaste | node claude-log-to-html.js > output.html  # From clipboard on macOS
 */

const fs = require('fs');
const path = require('path');

// Read input from file argument or stdin
let input = '';

if (process.argv[2]) {
  input = fs.readFileSync(process.argv[2], 'utf8');
} else {
  input = fs.readFileSync(0, 'utf8'); // stdin
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function convertLine(line) {
  const escaped = escapeHtml(line);

  // User input lines (start with > )
  if (/^>\s/.test(line)) {
    return `<div class="user-input">${escaped}</div>`;
  }

  // Claude bullet point
  if (line.startsWith('⏺')) {
    let content = escaped.replace(/^⏺\s*/, '');

    // Tool calls with (MCP)
    if (content.includes('(MCP)')) {
      content = content.replace(
        /(\w+-\w+)\s*-\s*(\w+)\s*\(MCP\)/g,
        '<span class="tool-call">$1 - <span class="tool-name">$2</span> <span class="mcp-tag">(MCP)</span></span>'
      );
      // Parameters in parentheses
      content = content.replace(
        /\(([^)]+)\)$/,
        '<span class="param">($1)</span>'
      );
    }

    // Search/Read/Update commands
    content = content.replace(
      /^(Search|Read|Update|Glob|Grep)\(/,
      '<span class="search">$1</span>('
    );

    return `<div class="claude"><span class="bullet">⏺</span> ${content}</div>`;
  }

  // Result lines (start with ⎿)
  if (line.includes('⎿')) {
    let content = escaped;

    // Success messages
    content = content.replace(
      /(Successfully [^<]+)/g,
      '<span class="success">$1</span>'
    );

    // Result headers
    content = content.replace(
      /(# \w+ response)/g,
      '<span class="result-header">$1</span>'
    );

    // Image placeholders
    content = content.replace(
      /\[Image\]/g,
      '<span class="image-placeholder">[Image]</span>'
    );

    // Interrupted
    content = content.replace(
      /(Interrupted[^<]*)/g,
      '<span class="interrupted">$1</span>'
    );

    return `<div class="result">${content}</div>`;
  }

  // Table rows
  if (line.includes('|') && !line.startsWith('  ')) {
    return `<div class="table-row">${escaped}</div>`;
  }

  // Code/diff lines
  if (/^\s*\d+\s*[+-]/.test(line)) {
    if (line.includes('+')) {
      return `<div class="line-add">${escaped}</div>`;
    } else if (line.includes('-')) {
      return `<div class="line-remove">${escaped}</div>`;
    }
  }

  // Line numbers
  if (/^\s*\d+\s/.test(line)) {
    return `<div class="line-num">${escaped}</div>`;
  }

  // Default
  return `<div>${escaped}</div>`;
}

function generateHtml(input) {
  const lines = input.split('\n');
  const body = lines.map(convertLine).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Session</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --fg: #e2e8f0;
      --green: #48bb78;
      --cyan: #63b3ed;
      --yellow: #ecc94b;
      --red: #fc8181;
      --purple: #b794f4;
      --gray: #718096;
      --blue: #4299e1;
      --dim: #4a5568;
    }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    .user-input {
      color: var(--fg);
      background: #2d3748;
      padding: 0.5rem 1rem;
      margin: 0.5rem 0;
      border-left: 3px solid var(--blue);
    }
    .claude {
      margin: 0.25rem 0;
    }
    .bullet {
      color: var(--purple);
    }
    .tool-call {
      color: var(--cyan);
    }
    .tool-name {
      color: var(--yellow);
      font-weight: bold;
    }
    .mcp-tag {
      color: var(--purple);
    }
    .param {
      color: var(--gray);
    }
    .result {
      color: var(--dim);
      margin-left: 1rem;
      border-left: 2px solid var(--dim);
      padding-left: 0.5rem;
    }
    .result-header {
      color: var(--gray);
    }
    .success {
      color: var(--green);
    }
    .search {
      color: var(--cyan);
    }
    .file-path {
      color: var(--yellow);
    }
    .line-add {
      color: var(--green);
    }
    .line-remove {
      color: var(--red);
    }
    .line-num {
      color: var(--dim);
    }
    .image-placeholder {
      color: var(--dim);
      background: #2d3748;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    .interrupted {
      color: var(--red);
      font-style: italic;
    }
    .table-row {
      font-family: monospace;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

console.log(generateHtml(input));
