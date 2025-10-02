<!------------------------------------------------------------------------------------
   Add Rules to this file or a short description and have Kiro refine them for you:   
------------------------------------------------------------------------------------->

When user submit a problem(s) or report errors, please do these:

Immediate Analysis: I'd analyze the error stack trace to identify:

The exact line causing the issue
The component and function involved
The data flow leading to the undefined state
Root Cause Investigation: I'd examine:

State initialization patterns
localStorage data structure and potential corruption
Component lifecycle and when the error occurs
Defensive programming gaps
Solution Strategy: I'd propose:

Defensive programming with null checks (array || [])
Proper state initialization with fallbacks
Input validation and sanitization
Error boundaries if needed
Systematic Fix: Rather than quick patches, I'd:

Create a spec to document the problem systematically
Design a comprehensive solution addressing all similar vulnerabilities
Implement with proper testing to prevent regression
Prevention: I'd suggest:

Code review patterns to catch similar issues
TypeScript for better type safety
Unit tests for edge cases

## Spec Creation Workflow

When creating specs for problem fixes or new features:

1. **Do not ask for approval** for requirements.md, design.md, and tasks.md
2. **Generate all three documents** (requirements, design, tasks) automatically without user input
3. **Proceed directly to implementation** after creating the complete spec
4. **Only ask for clarification** if the problem description is unclear or missing critical information
5. **Create comprehensive specs** that cover all aspects of the issue systematically
6. Restart(stop exisitng one and start a new one) backend server(3001) if backend codes are updated.

This streamlined approach allows for faster problem resolution while maintaining systematic documentation.
