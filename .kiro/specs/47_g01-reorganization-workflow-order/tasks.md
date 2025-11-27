# Spec 47: Tasks - G01 Reorganization

## Task 1: Rename Directories

**Priority**: P0
**Estimate**: 5 minutes

```bash
cd .kiro/specs/generic/G01_adding-new-parameter/

# Rename to new workflow order
mv 08-parameter-relationships 02-parameter-relationships-temp
mv 07-unified-handling 03-unified-handling-temp
mv 02-backend 04-backend-temp
mv 03-configuration 05-configuration-temp
mv 04-frontend 06-frontend-temp
mv 05-url 07-url-temp
mv 06-testing 08-testing-temp

# Remove -temp suffix
for dir in *-temp; do mv "$dir" "${dir%-temp}"; done
```

**Verification**:
```bash
ls -la | grep "^d" | awk '{print $NF}' | sort
# Should show: 01-overview, 02-parameter-relationships, 03-unified-handling, 04-backend, 05-configuration, 06-frontend, 07-url, 08-testing, reference-parameters
```

---

## Task 2: Update G01 Main README.md

**Priority**: P0
**Estimate**: 10 minutes

**File**: `.kiro/specs/generic/G01_adding-new-parameter/README.md`

**Changes**:
1. Update "Guide Structure" section (line ~10-18)
2. Update "Quick Start" section (line ~104) - emphasize Step 2
3. Update all internal link references

**Verification**: `grep -n "02-parameter-relationships\|03-unified-handling\|04-backend" README.md`

---

## Task 3: Update Generic README.md

**Priority**: P0
**Estimate**: 10 minutes

**File**: `.kiro/specs/generic/README.md`

**Changes**:
1. Update G01 structure diagram (line ~22-35)
2. Update workflow diagram (line ~70-115)
3. Update "For Adding New Parameters" section

**Verification**: `grep -n "02-parameter-relationships" ../README.md`

---

## Task 4: Test Navigation

**Priority**: P1
**Estimate**: 5 minutes

Manually verify:
- [ ] All internal links work in G01 README.md
- [ ] All internal links work in generic README.md
- [ ] Section numbers match directory names

---

## Total Estimate

**30 minutes** for complete reorganization and verification