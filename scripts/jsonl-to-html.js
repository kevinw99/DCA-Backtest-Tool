#!/usr/bin/env node
/**
 * Convert Claude JSONL conversation log to styled HTML
 *
 * Usage: node jsonl-to-html.js <input.jsonl> <output.html> [--from "search text"]
 */

const fs = require('fs');

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const fromFlag = process.argv.indexOf('--from');
const fromText = fromFlag > -1 ? process.argv[fromFlag + 1] : null;

if (!inputFile || !outputFile) {
  console.error('Usage: node jsonl-to-html.js <input.jsonl> <output.html> [--from "search text"]');
  process.exit(1);
}

const lines = fs.readFileSync(inputFile, 'utf8').split('\n').filter(Boolean);
const messages = [];

let startCapture = !fromText;
let conversationStarted = false;

for (const line of lines) {
  try {
    const obj = JSON.parse(line);

    // Check if we should start capturing
    if (fromText && !startCapture) {
      const content = JSON.stringify(obj);
      if (content.includes(fromText)) {
        startCapture = true;
      }
    }

    if (!startCapture) continue;

    // Capture queue-operation (enqueue) as user prompts - these are messages typed while Claude is working
    if (obj.type === 'queue-operation' && obj.operation === 'enqueue' && obj.content) {
      const content = obj.content.trim();
      if (content) {
        messages.push({ role: 'user', content: content, timestamp: obj.timestamp });
        conversationStarted = true;
      }
    }

    // Capture regular user messages
    if (obj.type === 'user' && obj.message?.content) {
      const content = typeof obj.message.content === 'string'
        ? obj.message.content
        : obj.message.content.find(c => c.type === 'text')?.text || '';

      if (content && !content.includes('tool_result') && content.trim()) {
        messages.push({ role: 'user', content: content.trim(), timestamp: obj.timestamp });
        conversationStarted = true;
      }
    }

    if (obj.type === 'assistant' && obj.message?.content && conversationStarted) {
      const textContent = obj.message.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      const toolCalls = obj.message.content
        .filter(c => c.type === 'tool_use')
        .map(c => ({ name: c.name, input: c.input }));

      if (textContent || toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: textContent,
          tools: toolCalls,
          timestamp: obj.timestamp
        });
      }
    }
  } catch (e) {
    // Skip invalid JSON lines
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatContent(text) {
  let html = escapeHtml(text);
  // Convert markdown-style formatting
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Convert newlines
  html = html.replace(/\n/g, '<br>\n');
  return html;
}

// Generate HTML
let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spec 71: IBKR API Integration - Verbatim Conversation</title>
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
      --orange: #ed8936;
    }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 {
      color: var(--cyan);
      border-bottom: 1px solid var(--dim);
      padding-bottom: 0.5rem;
      font-size: 1.3rem;
    }
    .message-box {
      border: 1px solid var(--dim);
      border-radius: 8px;
      margin: 1rem 0;
      overflow: hidden;
    }
    .message-header {
      background: #2d3748;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--dim);
      font-weight: bold;
      display: flex;
      justify-content: space-between;
    }
    .message-header.user { color: var(--blue); }
    .message-header.assistant { color: var(--purple); }
    .timestamp { color: var(--gray); font-size: 11px; font-weight: normal; }
    .message-content {
      padding: 1rem;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .tool-calls {
      background: #1e3a2f;
      padding: 0.75rem 1rem;
      margin-top: 0.5rem;
      border-radius: 4px;
    }
    .tool-call {
      color: var(--cyan);
      margin: 0.25rem 0;
    }
    .tool-name { color: var(--yellow); font-weight: bold; }
    code {
      background: #2d3748;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      color: var(--green);
    }
    .back-link {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: var(--purple);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      text-decoration: none;
      font-size: 12px;
    }
    .note {
      color: var(--gray);
      font-style: italic;
      margin: 1rem 0;
      padding: 0.5rem;
      border-left: 2px solid var(--dim);
    }
  </style>
</head>
<body>
  <a href="javascript:history.back()" class="back-link">← Back to Slides</a>

  <h1>Spec 71: IBKR API Integration - Verbatim Conversation Log</h1>
  <p class="note">This is the complete, unedited conversation transcript from the Claude Code session that developed Spec 71.</p>
  <p style="color: var(--gray); font-size: 12px;">
    <strong>GitHub:</strong> <a href="https://github.com/kevinw99/DCA-Backtest-Tool/tree/main/.kiro/specs/71_ibkr-api-integration" style="color: var(--cyan);">.kiro/specs/71_ibkr-api-integration/</a>
  </p>
  <p style="color: var(--gray); font-size: 12px;">
    <strong>Summarized version:</strong> <a href="spec71-conversation.html" style="color: var(--cyan);">spec71-conversation.html</a>
  </p>

`;

for (const msg of messages) {
  const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
  const roleLabel = msg.role === 'user' ? 'USER PROMPT' : 'CLAUDE';

  html += `  <div class="message-box">
    <div class="message-header ${msg.role}">
      <span>${roleLabel}</span>
      <span class="timestamp">${timestamp}</span>
    </div>
    <div class="message-content">${formatContent(msg.content || '')}</div>`;

  if (msg.tools && msg.tools.length > 0) {
    html += `    <div class="tool-calls">`;
    for (const tool of msg.tools) {
      const desc = tool.input?.description || tool.input?.prompt?.substring(0, 80) || '';
      html += `      <div class="tool-call">⏺ <span class="tool-name">${tool.name}</span>${desc ? ': ' + escapeHtml(desc) : ''}</div>\n`;
    }
    html += `    </div>`;
  }

  html += `  </div>\n\n`;
}

html += `</body>\n</html>`;

fs.writeFileSync(outputFile, html);
console.log(`Converted ${messages.length} messages to ${outputFile}`);
