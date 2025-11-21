#!/usr/bin/env python3
"""
Convert plain text Claude Code session to colorized HTML
Usage: python3 colorize_session.py input.txt output.html
"""

import sys
import re
import html

def colorize_session(text):
    """Convert plain text to colorized HTML"""

    # HTML template with nice styling
    html_header = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Claude Code Session</title>
    <style>
        body {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            line-height: 1.6;
        }
        .user-message {
            color: #4ec9b0;
            font-weight: bold;
            margin-top: 20px;
        }
        .assistant-message {
            color: #9cdcfe;
            margin-top: 15px;
        }
        .code-block {
            background-color: #2d2d2d;
            border-left: 3px solid #007acc;
            padding: 10px;
            margin: 10px 0;
            overflow-x: auto;
        }
        .code-addition {
            background-color: #1a3a1a;
            color: #4ec9b0;
        }
        .code-removal {
            background-color: #3a1a1a;
            color: #f48771;
            text-decoration: line-through;
        }
        .file-path {
            color: #ce9178;
            font-style: italic;
        }
        .command {
            color: #dcdcaa;
            background-color: #2d2d2d;
            padding: 2px 5px;
            border-radius: 3px;
        }
        .success {
            color: #4ec9b0;
        }
        .error {
            color: #f48771;
        }
        .warning {
            color: #dcdcaa;
        }
        .emoji {
            font-size: 1.2em;
        }
        .tool-use {
            background-color: #264f78;
            border-left: 3px solid #007acc;
            padding: 8px;
            margin: 8px 0;
        }
        .header {
            color: #569cd6;
            font-weight: bold;
            font-size: 1.1em;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
<h1 style="color: #569cd6;">Claude Code Session</h1>
<pre>"""

    html_footer = """</pre>
</body>
</html>"""

    # Process the text line by line
    lines = text.split('\n')
    output = []
    in_code_block = False

    for line in lines:
        # Escape HTML
        line = html.escape(line)

        # Detect user messages (usually start with specific patterns)
        if line.strip().startswith(('Human:', 'User:', '>')):
            line = f'<span class="user-message">{line}</span>'

        # Detect assistant messages
        elif line.strip().startswith(('Assistant:', 'Claude:')):
            line = f'<span class="assistant-message">{line}</span>'

        # Detect file paths
        elif '/' in line and ('.js' in line or '.py' in line or '.json' in line or '.md' in line):
            line = f'<span class="file-path">{line}</span>'

        # Detect commands (lines starting with $ or containing bash commands)
        elif line.strip().startswith(('$', 'npm', 'git', 'cd', 'ls', 'curl')):
            line = f'<span class="command">{line}</span>'

        # Detect success messages
        elif any(word in line.lower() for word in ['✅', 'success', 'completed', 'done']):
            line = f'<span class="success">{line}</span>'

        # Detect error messages
        elif any(word in line.lower() for word in ['❌', 'error', 'failed', 'failure']):
            line = f'<span class="error">{line}</span>'

        # Detect warnings
        elif any(word in line.lower() for word in ['⚠️', 'warning', 'warn']):
            line = f'<span class="warning">{line}</span>'

        # Detect code additions (lines starting with +)
        elif line.strip().startswith('+') and not line.strip().startswith('++'):
            line = f'<span class="code-addition">{line}</span>'

        # Detect code removals (lines starting with -)
        elif line.strip().startswith('-') and not line.strip().startswith('--'):
            line = f'<span class="code-removal">{line}</span>'

        # Detect headers
        elif line.strip().startswith('#'):
            line = f'<span class="header">{line}</span>'

        # Detect tool use
        elif 'tool' in line.lower() or 'invoke' in line.lower():
            line = f'<span class="tool-use">{line}</span>'

        output.append(line)

    return html_header + '\n'.join(output) + html_footer


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 colorize_session.py input.txt [output.html]")
        print("\nIf output file is not specified, will create input_colored.html")
        sys.exit(1)

    input_file = sys.argv[1]

    # Determine output file
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    else:
        output_file = input_file.rsplit('.', 1)[0] + '_colored.html'

    # Read input
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            text = f.read()
    except Exception as e:
        print(f"Error reading {input_file}: {e}")
        sys.exit(1)

    # Convert to HTML
    html_output = colorize_session(text)

    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_output)
        print(f"✅ Successfully created {output_file}")
        print(f"📂 Open in browser to view colored output")
    except Exception as e:
        print(f"Error writing {output_file}: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
