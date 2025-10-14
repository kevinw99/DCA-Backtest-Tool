# Phase 2 Implementation Notes - Option A

## Current Status

**Progress:** Working on `createDCAExecutor()` implementation using Option A approach

## Challenge Discovered

While implementing Option A, I discovered that even the "simpler" approach requires significant refactoring because:

1. **`runDCABacktest()` is NOT designed for interruption**
   - It's a single function that runs from start to finish
   - The main loop (lines 2289-2291) is deeply embedded in the function
   - State is managed via closure variables that can't be easily exported

2. **`processOneDayOfTrading()` exists but is closure-bound**
   - It's already extracted (Phase 1) BUT it lives inside `runDCABacktest` closure
   - It depends on ~80 closure-scoped variables
   - It calls ~30 helper functions also in the closure

## Option A Reality Check

The "simpler" Option A still requires either:

**Approach A1: Make runDCABacktest support step-mode**
- Add a `stepMode` parameter to `runDCABacktest`
- Modify the main loop to yield after each day
- Allow external control of the loop iteration
- **Complexity:** Medium (~200 lines of changes)

**Approach A2: Extract just the state initialization**
- Copy state initialization (lines 798-877) to `createDCAExecutor`
- Copy helper function definitions (~1200 lines)
- Wrap `processOneDayOfTrading` with the copied state
- **Complexity:** High (~1500 lines of code duplication)

**Approach A3: Hybrid - Run full backtest but with callback**
- Let Portfolio provide a `dayCallback(date, context)` function
- `runDCABacktest` calls the callback before each day
- Callback returns `{buyEnabled: boolean}`
- **Complexity:** Low (~50 lines of changes)

## Recommended: Approach A3 (Callback-based)

This is the TRUE "Option A" - minimal changes, maximum compatibility.

### Implementation Plan

1. **Modify `runDCABacktest` main loop** (line 2289-2291):
   ```javascript
   // BEFORE:
   for (let i = 0; i < pricesWithIndicators.length; i++) {
     await processOneDayOfTrading(pricesWithIndicators[i], i, { buyEnabled: true });
   }

   // AFTER:
   for (let i = 0; i < pricesWithIndicators.length; i++) {
     const dayContext = dayCallback ?
       await dayCallback(pricesWithIndicators[i].date, i) :
       { buyEnabled: true };
     await processOneDayOfTrading(pricesWithIndicators[i], i, dayContext);
   }
   ```

2. **Add `dayCallback` parameter to `runDCABacktest`**:
   ```javascript
   async function runDCABacktest(params, dayCallback = null) {
     // ...existing code...
   }
   ```

3. **Implement `createDCAExecutor` using callback approach**:
   ```javascript
   async function createDCAExecutor(symbol, params, pricesWithIndicators) {
     let capitalAvailable = true; // Controlled by Portfolio

     // Create callback that Portfolio will control
     const dayCallback = async (date, dayIndex) => {
       return { buyEnabled: capitalAvailable };
     };

     // Run backtest with our callback
     const results = await runDCABacktest({
       ...params,
       symbol
     }, dayCallback);

     return {
       setCapitalAvailable: (available) => { capitalAvailable = available; },
       getResults: () => results
     };
   }
   ```

## Why This Works

- **Portfolio controls capital** via `setCapitalAvailable()`
- **Individual DCA executes** using its mature algorithm
- **Minimal changes** to existing code (~50 lines)
- **Low risk** - battle-tested code preserved
- **Easy to test** - can verify baseline immediately

## Next Session Action

Implement Approach A3 (callback-based) - this is the cleanest Option A implementation.

## Alternative: Accept Current Limitations

If even Approach A3 is too complex for immediate needs, we could:
- Keep `createDCAExecutor()` as a stub for now
- Have Portfolio simply call `runDCABacktest()` for each stock with full date range
- Accept that capital gating happens at stock level, not day level
- This gives us 80% of the benefit with 20% of the work

**Trade-off:** Portfolio wouldn't have perfect day-by-day capital control, but each stock would use the mature Individual DCA algorithm.
