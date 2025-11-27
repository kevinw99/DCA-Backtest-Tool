# Spec 47: Design - G01 Reorganization

## Overview

Simple directory renaming operation to align physical structure with logical workflow. No content changes.

## Reorganization Mapping

### Current → New Directory Names

```
.kiro/specs/generic/G01_adding-new-parameter/
├── 01-overview/                     → 01-overview/  (NO CHANGE)
├── 02-backend/                      → 04-backend/   (RENAME)
├── 03-configuration/                → 05-configuration/  (RENAME)
├── 04-frontend/                     → 06-frontend/  (RENAME)
├── 05-url/                          → 07-url/  (RENAME)
├── 06-testing/                      → 08-testing/  (RENAME)
├── 07-unified-handling/             → 03-unified-handling/  (RENAME)
├── 08-parameter-relationships/      → 02-parameter-relationships/  (RENAME)
└── reference-parameters/            → reference-parameters/  (NO CHANGE)
```

## Implementation Steps

### Step 1: Rename Directories

```bash
cd .kiro/specs/generic/G01_adding-new-parameter/

# Create temp directory for swap
mkdir -p .temp

# Move sections to temp with new names
mv 08-parameter-relationships .temp/02-parameter-relationships
mv 07-unified-handling .temp/03-unified-handling
mv 02-backend .temp/04-backend
mv 03-configuration .temp/05-configuration
mv 04-frontend .temp/06-frontend
mv 05-url .temp/07-url
mv 06-testing .temp/08-testing

# Move from temp back
mv .temp/* .

# Remove temp
rmdir .temp
```

### Step 2: Update Main README.md

Location: `.kiro/specs/generic/G01_adding-new-parameter/README.md`

**Changes**:

1. **Structure section** (line ~20):
```markdown
## Guide Structure

This guide is organized into 8 sections:

1. **[01-overview](./01-overview/)** - Overview, checklist, and architecture
2. **[02-parameter-relationships](./02-parameter-relationships/)** - Analyzing parameter interactions and conflicts (CRITICAL!)
3. **[03-unified-handling](./03-unified-handling/)** - Unified parameter handling principles (CRITICAL!)
4. **[04-backend](./04-backend/)** - Backend implementation (executor, service, API)
5. **[05-configuration](./05-configuration/)** - Configuration defaults and ticker-specific settings
6. **[06-frontend](./06-frontend/)** - Frontend UI components and React state
7. **[07-url](./07-url/)** - URL parameter encoding and decoding
8. **[08-testing](./08-testing/)** - Comprehensive testing across all modes
```

2. **Quick Start section** (line ~104):
```markdown
## Quick Start: Adding a New Parameter

### ⚠️ CRITICAL: Step 1 - Study Reference Parameters (REQUIRED)

Before writing any code, study the reference parameters:
...

### ⚠️ CRITICAL: Step 2 - Analyze Parameter Relationships FIRST

**BEFORE writing ANY code**, read [02-parameter-relationships](./02-parameter-relationships/README.md)

Create a relationship table showing:
- What parameters are affected by your new parameter
- What parameters contradict your new parameter
- What conditions are introduced

This prevents bugs, conflicts, and user confusion!

### Step 3: Understand Unified Handling Principles

Read [03-unified-handling](./03-unified-handling/README.md) to understand:
- How to integrate into existing code paths
- How to avoid creating ad-hoc code
- When to refactor for unified handling

### Step 4: Follow the Checklist
...

### Step 5: Implement Backend First
...
```

3. **Update all other references** from 02-08 to 04-08 where they reference backend/config/frontend/url/testing

### Step 3: Update Generic README

Location: `.kiro/specs/generic/README.md`

Update the G01 structure diagram (line ~22-35):
```markdown
**Structure**:
```
G01_adding-new-parameter/
├── README.md                          # Main guide with navigation
├── 01-overview/                       # Architecture and checklist
├── 02-parameter-relationships/        # Analysis framework (CRITICAL - do this FIRST!)
├── 03-unified-handling/               # Principles for avoiding duplicate code
├── 04-backend/                        # Backend implementation
├── 05-configuration/                  # Configuration defaults
├── 06-frontend/                       # Frontend UI components
├── 07-url/                            # URL parameter handling
├── 08-testing/                        # Testing and verification
└── reference-parameters/              # Complete working examples
    ├── trailingBuyReboundPercent.md   # Number/percentage type reference
    └── enableConsecutiveIncrementalBuyGrid.md  # Boolean type reference
```
```

Update workflow diagram (line ~73-115) to show new order.

## Testing

### Verification Steps

1. Check all directories renamed correctly:
```bash
ls -la .kiro/specs/generic/G01_adding-new-parameter/
# Should show: 01, 02-parameter-relationships, 03-unified-handling, 04-08...
```

2. Verify all README.md files updated:
```bash
# Check main G01 README has new structure
grep "02-parameter-relationships" .kiro/specs/generic/G01_adding-new-parameter/README.md

# Check generic README updated
grep "02-parameter-relationships" .kiro/specs/generic/README.md
```

3. Test navigation links work (manually browse in editor)

## Rollback Plan

If issues arise, revert directories:
```bash
cd .kiro/specs/generic/G01_adding-new-parameter/

mv 02-parameter-relationships 08-parameter-relationships
mv 03-unified-handling 07-unified-handling
mv 04-backend 02-backend
mv 05-configuration 03-configuration
mv 06-frontend 04-frontend
mv 07-url 05-url
mv 08-testing 06-testing
```

Then revert README.md changes via git.

## Impact

**Zero functional impact** - only documentation reorganization.

**User benefit**: Developers naturally read in correct order (analyze → principles → implement)
