# Spec 47: G01 Reorganization - Workflow Order

## Problem Statement

The current G01_adding-new-parameter guide has sections in chronological order (01-08), but the **logical workflow doesn't match the physical structure**:

**Current Structure** (Physical Order):
```
01-overview
02-backend
03-configuration
04-frontend
05-url
06-testing
07-unified-handling        ← PRINCIPLES (should be early!)
08-parameter-relationships ← ANALYZE FIRST (should be #2!)
```

**Problem**: Developers read sections in order (01→08), but they should actually:
1. Read overview (01)
2. **ANALYZE parameter relationships FIRST** (currently 08)
3. **Understand unified handling principles** (currently 07)
4. THEN implement (02-06)

**Impact**: Risk of developers starting implementation before analyzing parameter conflicts, leading to bugs and user confusion.

## Requirements

### REQ-1: Logical Workflow Order

Reorganize sections to match actual workflow:

```
01-overview                     ← Understand system
02-parameter-relationships      ← ANALYZE FIRST (was 08)
03-unified-handling             ← PRINCIPLES (was 07)
04-backend                      ← Then implement (was 02)
05-configuration                ← (was 03)
06-frontend                     ← (was 04)
07-url                          ← (was 05)
08-testing                      ← (was 06)
```

### REQ-2: Preserve All Content

- No content changes
- All existing files remain with same content
- Only directory names change

### REQ-3: Update Main README

Update G01_adding-new-parameter/README.md to:
- Emphasize Step 2 (parameter relationships) as CRITICAL
- Update Quick Start workflow to highlight analysis-first approach
- Add warning about reading 02 before implementing

### REQ-4: Update Cross-References

Update any internal links:
- `reference-parameters/*.md` files
- Main README navigation links