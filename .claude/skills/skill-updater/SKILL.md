---
name: skill-updater
description: Maintain and update Claude Code skills based on lessons learned, workflow improvements, and project evolution. Use after completing specs, fixing bugs, or when workflows change. Ensures skills stay current with actual practices.
---

# Skill Updater Meta-Skill

Maintains the lifecycle of all Claude Code skills in this project.

## When to Use This Skill

Use this skill when:
- Completing a major spec (especially parameter-related specs)
- Fixing bugs that reveal workflow gaps
- CLAUDE.md is updated with new practices
- Discovering better approaches during development
- Skills contain outdated information
- Monthly skill maintenance reviews

## Skill Update Triggers

### 1. After Spec Completion

**Trigger**: Spec is implemented and committed

**Action**: Review related skills for updates

**Example**:
```
Spec 45 & 46 completed (momentum parameters)
→ Update g01-parameter-adder with batch mode lessons
→ Update spec-generator with G01 compliance emphasis
→ Add real examples from implementation
```

**Process**:
1. Read the spec's requirements.md, design.md, tasks.md
2. Identify lessons learned (especially from verification-findings.md)
3. Check which skills are related
4. Update skills with:
   - New patterns discovered
   - Common mistakes to avoid
   - Real code examples
   - Verification steps that worked

### 2. After Bug Fixes

**Trigger**: Bug fixed with root cause identified

**Action**: Update debugging skills

**Example**:
```
Bug: Execution order causing orders to disappear
→ Update bug-investigator with execution order checking
→ Update comprehensive-fixer with similar pattern search
```

**Process**:
1. Document what made the bug hard to find
2. Add debugging steps to bug-investigator
3. Add pattern to comprehensive-fixer
4. Create test case in backtest-tester

### 3. When Workflows Improve

**Trigger**: CLAUDE.md updated, new tools added, better practices discovered

**Action**: Sync skills with new workflow

**Example**:
```
CLAUDE.md: Added parallel testing emphasis
→ Update all skills to mention parallel Task agents
→ Add examples of parallel testing
```

### 4. Periodic Maintenance

**Schedule**: Monthly or after major milestones

**Action**: Review all skills for accuracy

**Checklist**:
- [ ] Do skills match current CLAUDE.md?
- [ ] Are code examples still accurate?
- [ ] Do file paths still exist?
- [ ] Are there new patterns not captured?
- [ ] Version numbers up to date?

## Skill Versioning System

**Format**: `v1.2.3`
- Major: Significant workflow changes
- Minor: New sections, examples, or lessons
- Patch: Typos, clarifications, minor fixes

**Metadata** (in YAML frontmatter):
```yaml
---
name: skill-name
description: ...
version: 1.2.0
last_updated: 2025-10-26
changelog: |
  v1.2.0 (2025-10-26): Added batch mode lessons from Spec 46
  v1.1.0 (2025-10-26): Enhanced with Spec 45 examples
  v1.0.0 (2025-10-26): Initial creation
---
```

## Update Templates

### Template 1: Add Lessons Learned Section

```markdown
## Lessons Learned

### From Spec XX: [Spec Name]

**Date**: YYYY-MM-DD

**What We Learned**:
- Lesson 1: [Description]
- Lesson 2: [Description]

**How It Affects This Skill**:
- Update section X to include...
- Add new verification step...
- Emphasize pattern Y...

**Example From Implementation**:
```[language]
// Real code from Spec XX
```
```

### Template 2: Add Common Mistake

```markdown
### ❌ Pitfall X: [Mistake Name]

**Problem**: [What goes wrong]

**Example** (from Spec XX):
```
[Code showing the mistake]
```

**Solution**:
```
[Code showing the fix]
```

**How to Avoid**:
1. Check [specific thing]
2. Verify [another thing]
3. Test [scenario]
```

### Template 3: Update Workflow Step

```markdown
### Step X: [Step Name] (UPDATED - Spec XX)

**Previous Approach**:
[Old way of doing things]

**New Approach** (discovered in Spec XX):
[Better way]

**Why It's Better**:
- Reason 1
- Reason 2

**Example**:
[Code or commands showing new approach]
```

## Skill Maintenance Log

Track all skill updates in `.claude/skills/MAINTENANCE_LOG.md`:

```markdown
# Skill Maintenance Log

## 2025-10-26 - Post Spec 45 & 46 Update

**Updated Skills**:
- g01-parameter-adder: v1.0.0 → v1.1.0
  - Added batch mode critical section
  - Added Spec 46 lessons on state management
  - Enhanced verification checklist

- spec-generator: v1.0.0 → v1.1.0
  - Emphasized G01 compliance for parameters
  - Added automatic compliance checking step

**Reason**: Completed momentum parameter implementation, learned critical batch mode patterns

**Files Changed**:
- .claude/skills/g01-parameter-adder/SKILL.md
- .claude/skills/spec-generator/SKILL.md

**Commit**: [commit hash]
```

## Update Workflow

### Step 1: Identify What Changed

Review recent work:
```bash
# Check recent specs
ls -t .kiro/specs/ | head -5

# Check recent commits
git log --oneline -10

# Check CLAUDE.md changes
git log -p CLAUDE.md | head -50
```

### Step 2: Map Changes to Skills

Create mapping:
```
Change: Spec 46 batch mode findings
→ Affects: g01-parameter-adder, spec-generator

Change: Bug fix in execution order
→ Affects: bug-investigator, comprehensive-fixer

Change: New parallel testing approach
→ Affects: backtest-tester, comprehensive-fixer
```

### Step 3: Update Skills

For each skill:
1. Read current version
2. Increment version number
3. Add changelog entry
4. Update content with:
   - New lessons learned
   - Better examples
   - Updated workflows
   - New pitfalls/mistakes
5. Test skill is still valid

### Step 4: Document Updates

1. Update `.claude/skills/MAINTENANCE_LOG.md`
2. Create git commit with:
   ```
   chore(skills): Update [skill-name] with [source] lessons

   - Add lesson X from Spec YY
   - Update section Z with better approach
   - Add common mistake discovered in bug fix

   Version: v1.0.0 → v1.1.0
   ```

### Step 5: Verify Skills Work

After updates:
1. Read updated skills
2. Check examples still work
3. Verify file paths exist
4. Test code snippets are accurate

## Proactive Update Patterns

### Pattern 1: Post-Spec Update

**When**: Right after committing a spec

**What to do**:
```bash
# 1. Review the spec
cat .kiro/specs/XX_name/verification-findings.md

# 2. Identify lessons
# 3. Update related skills
# 4. Commit with spec reference
```

### Pattern 2: Post-Bug-Fix Update

**When**: After fixing a complex bug

**What to do**:
1. Document what made bug hard to find
2. Add debugging steps to bug-investigator
3. Add pattern to look for in comprehensive-fixer
4. Create regression test in backtest-tester

### Pattern 3: Monthly Review

**When**: End of month or major milestone

**What to do**:
1. Review all skill versions
2. Check against current CLAUDE.md
3. Verify examples still work
4. Look for emerging patterns not yet captured
5. Batch update multiple skills

## Skill Quality Checklist

Before committing skill updates:

**Accuracy**:
- [ ] All file paths exist and are correct
- [ ] All code examples are tested and work
- [ ] All commands have been verified
- [ ] References to other docs are valid

**Completeness**:
- [ ] Version number incremented appropriately
- [ ] Changelog entry added
- [ ] Lessons learned section updated (if applicable)
- [ ] Examples include real code from specs

**Clarity**:
- [ ] Instructions are clear and actionable
- [ ] Examples are realistic
- [ ] Common mistakes are well-explained
- [ ] Workflow steps are logical

**Relevance**:
- [ ] Reflects current practices (matches CLAUDE.md)
- [ ] Includes recent patterns
- [ ] Removes outdated information
- [ ] Examples are from actual implementation

## Skill Dependency Map

Track which skills relate to each other:

```
spec-generator
  ↓ creates specs that inform
g01-parameter-adder
  ↓ implementations get tested by
backtest-tester
  ↓ bugs found get fixed by
bug-investigator + comprehensive-fixer
  ↓ fixes create lessons for
skill-updater (this skill)
  ↓ updates all skills
```

**Implication**: When updating one skill, check dependencies.

## Meta: Updating This Skill

**When to update skill-updater**:
- New skill update patterns discovered
- Better versioning approach found
- New maintenance workflow established
- Skill dependency relationships change

**Self-update checklist**:
- [ ] Update templates with better formats
- [ ] Add new trigger types
- [ ] Enhance maintenance workflow
- [ ] Update version metadata approach

## Quick Reference

**Add lessons from recent spec**:
1. Read spec's verification-findings.md
2. Identify 3-5 key lessons
3. Update related skills with lessons
4. Increment version, add changelog
5. Commit with spec reference

**Monthly maintenance**:
1. Review all skills (5 total currently)
2. Check against CLAUDE.md
3. Verify examples work
4. Batch commit updates

**After bug fix**:
1. Add debugging approach to bug-investigator
2. Add pattern search to comprehensive-fixer
3. Add test case to backtest-tester
4. Commit with bug reference

## Current Skills to Maintain

1. **bug-investigator** - Update with new debugging patterns
2. **spec-generator** - Update with spec templates learned
3. **g01-parameter-adder** - Update with parameter implementation lessons
4. **comprehensive-fixer** - Update with fixing patterns
5. **backtest-tester** - Update with test approaches
6. **skill-updater** (this) - Meta-update with maintenance patterns

---

**Version**: 1.0.0
**Created**: 2025-10-26
**Last Updated**: 2025-10-26
**Changelog**:
- v1.0.0 (2025-10-26): Initial creation of meta-skill
