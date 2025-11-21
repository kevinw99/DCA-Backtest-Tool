# Documentation Guide

This directory contains all project documentation organized by category.

---

## Directory Structure

```
docs/
├── README.md                # This file
├── INDEX.md                 # Complete documentation index
│
├── status/                  # Project status and progress
│   ├── DEBUGGING_COMPLETE_SUMMARY.md
│   └── IMPLEMENTATION_PLAN.md
│
├── design/                  # Design documents and requirements
│   ├── REQUIREMENTS.md
│   └── REQUIREMENT_SHORT.md
│
├── analysis/                # Research and analysis documents
│   ├── DCA_STRATEGY_IMPROVEMENTS.md
│   ├── TSLA_TRAILING_STOP_ANALYSIS.md
│   └── BATCH_URL_PARAMETER_ANALYSIS.md
│
├── testing/                 # Test documentation and reports
│   ├── portfolio-backtest-complete-results.md
│   └── rejected-orders-test.md
│
├── reference/               # Reference documentation
│   ├── AGENTS.md
│   └── VERIFIED_URLS.md
│
├── guides/                  # User and developer guides
│   └── (future guides)
│
└── archive/                 # Historical/deprecated documents
    └── YYYY-MM-DD_description.md
```

---

## Documentation Categories

### Status & Progress (`status/`)
Current project status, implementation plans, and progress reports.

**When to add here:**
- Project status updates
- Implementation roadmaps
- Milestone summaries
- Debugging session reports

### Design Documents (`design/`)
Requirements, specifications, and architectural decisions.

**When to add here:**
- Requirements documents
- Architecture decisions
- System design documents
- Technical specifications

### Analysis & Research (`analysis/`)
Research findings, strategy analysis, and investigation results.

**When to add here:**
- Strategy analysis reports
- Performance investigations
- Research findings
- Algorithm analysis

### Testing Documentation (`testing/`)
Test plans, test results, and quality assurance documentation.

**When to add here:**
- Test result reports
- Testing strategies
- QA documentation
- Performance benchmarks

### Reference Material (`reference/`)
API documentation, system references, and lookup information.

**When to add here:**
- API endpoint lists
- System component references
- Configuration references
- Glossaries

### Guides (`guides/`)
User guides, developer guides, and how-to documentation.

**When to add here:**
- User guides
- Developer onboarding
- How-to documents
- Tutorial content

### Archive (`archive/`)
Historical documents and deprecated information.

**Naming convention:** `YYYY-MM-DD_description.md`

**When to add here:**
- Outdated documents
- Historical snapshots
- Deprecated specifications
- Old research

---

## Documentation Rules

⛔ **NO .md FILES IN ROOT DIRECTORY** (except README.md, CLAUDE.md, DEPLOYMENT.md)

All other documentation must be organized in this `docs/` directory.

### Essential Root Files Only
- `README.md` - Project overview
- `CLAUDE.md` - Claude instructions
- `DEPLOYMENT.md` - Deployment guide

### Everything Else Goes Here
All other documentation belongs in `docs/` subdirectories.

---

## Creating New Documentation

1. **Determine the category** based on document type
2. **Choose appropriate subdirectory** from structure above
3. **Use clear, descriptive filenames** (UPPER_SNAKE_CASE.md)
4. **Update docs/INDEX.md** with new document entry
5. **Follow naming conventions** for your category

### Naming Conventions

**Regular documents:** `UPPER_SNAKE_CASE.md`
- Examples: `TESTING_STRATEGY.md`, `API_REFERENCE.md`

**Archived documents:** `YYYY-MM-DD_description.md`
- Examples: `2025-11-20_old-requirements.md`

---

## Finding Documentation

### Quick Lookup
1. Check [INDEX.md](INDEX.md) for complete file listing
2. Browse category subdirectories
3. Use file search in your IDE

### By Category
- **What's the current status?** → `status/`
- **How is it designed?** → `design/`
- **What research was done?** → `analysis/`
- **What are the test results?** → `testing/`
- **Where's the API reference?** → `reference/`
- **How do I use it?** → `guides/`
- **Old documents?** → `archive/`

---

## Specifications

Feature specifications are stored separately in `.kiro/specs/` directory.

Each spec has a numbered directory:
```
.kiro/specs/
├── 01_feature-name/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── 02_another-feature/
└── ...
```

See [.kiro/specs/README.md](../.kiro/specs/README.md) for details.

---

## See Also

- [.docs-rules.md](../.docs-rules.md) - Documentation organization rules
- [.file-rules.md](../.file-rules.md) - File organization rules
- [INDEX.md](INDEX.md) - Complete documentation index
