# Git Helper Scripts

## stocks.db Management

The `backend/stocks.db` file is tracked by Git LFS but should NOT be committed with every local change. Local database modifications during development should stay local.

### Current Configuration

✅ `git update-index --skip-worktree backend/stocks.db` is active

This tells git to **ignore local changes** to stocks.db unless you explicitly want to update it.

---

## Commands

### Check if skip-worktree is Active
```bash
git ls-files -v | grep "^S" | grep stocks.db
```
**Expected output**: `S backend/stocks.db`

---

### Enable skip-worktree (Already Done)
```bash
git update-index --skip-worktree backend/stocks.db
```

**What this does:**
- Git will NOT show stocks.db in `git status` even if modified locally
- `git add .` will NOT stage stocks.db
- Your local database changes stay local

---

### Disable skip-worktree (When You Want to Update Production DB)
```bash
git update-index --no-skip-worktree backend/stocks.db
```

**Use this when:**
- Adding new stocks to production database
- Updating historical data for deployment
- Fixing data errors

**After updating production DB:**
1. Disable skip-worktree (command above)
2. Commit the database: `git add backend/stocks.db && git commit -m "Update stocks database"`
3. Push to GitHub
4. Re-enable skip-worktree: `git update-index --skip-worktree backend/stocks.db`

---

## Why skip-worktree Instead of .gitignore?

### .gitignore
- ❌ Would remove file from git entirely
- ❌ Would break LFS tracking
- ❌ Deployed environments wouldn't get the file

### skip-worktree
- ✅ File stays in git/LFS
- ✅ Deployed environments get the file
- ✅ Local changes ignored automatically
- ✅ Can temporarily disable to update production

---

## Troubleshooting

### Q: I need to pull updates from production database
```bash
# Temporarily disable skip-worktree
git update-index --no-skip-worktree backend/stocks.db

# Pull changes
git pull

# Re-enable skip-worktree
git update-index --skip-worktree backend/stocks.db
```

### Q: How do I check if my local database is different from production?
```bash
# Temporarily disable skip-worktree
git update-index --no-skip-worktree backend/stocks.db

# Check diff
git diff backend/stocks.db

# Re-enable skip-worktree
git update-index --skip-worktree backend/stocks.db
```

### Q: I accidentally committed stocks.db, how do I undo?
```bash
# If not pushed yet
git reset HEAD~ backend/stocks.db
git restore backend/stocks.db

# If already pushed (more complex - ask for help)
```

---

## Reference

**skip-worktree vs assume-unchanged:**
- `skip-worktree`: For files you expect to modify locally but not commit (our use case)
- `assume-unchanged`: For performance optimization on large files

We use `skip-worktree` because it survives `git pull` operations better.
