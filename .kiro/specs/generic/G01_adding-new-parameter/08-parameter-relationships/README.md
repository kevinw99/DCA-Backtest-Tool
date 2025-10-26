# G01/08: Parameter Relationships & Interactions

## Purpose

When adding a new parameter, it's critical to analyze how it interacts with existing parameters and conditions. This prevents:
- **Logic conflicts** (contradictory settings)
- **Unexpected behavior** (parameters overriding each other)
- **User confusion** (unclear precedence rules)
- **Bugs** (unintended interactions)

This guide provides a **reusable framework** for analyzing parameter relationships.

## Relationship Analysis Framework

For EVERY new parameter, create a table with three columns:

| Parameter/Condition | Affected by [NewParameter] | Contradictory to [NewParameter] |
|---------------------|---------------------------|----------------------------------|
| List all related parameters and conditions | Describe how they are modified/influenced | Describe conflicts or opposing behaviors |

### Column Definitions

**Column 1: Parameter/Condition**
- List ALL parameters and runtime conditions that:
  - Relate to the same feature area (e.g., buy logic, sell logic, grid spacing)
  - Could potentially interact with the new parameter
  - Share similar trigger conditions
  - Modify the same execution flow

**Column 2: Affected by [NewParameter]**
- How does the new parameter **modify** this parameter's behavior?
- What values/thresholds get **overridden**?
- What logic gets **bypassed** or **enhanced**?
- What **side effects** occur when new parameter is enabled?

**Column 3: Contradictory to [NewParameter]**
- Does this parameter represent an **opposing strategy**?
- Are there **mutually exclusive** behaviors?
- Would enabling both create **logical conflicts**?
- Should these be **prevented** from being used together?

## Example 1: `momentumBasedBuy` (Boolean - Spec 45)

**Parameter Type**: Boolean (feature flag)
**Purpose**: Enable buying on strength (uptrends) instead of weakness (downtrends)
**Default**: `false`

### Parameter Relationships Table

| Parameter/Condition | Affected by `momentumBasedBuy` | Contradictory to `momentumBasedBuy` |
|---------------------|-------------------------------|-------------------------------------|
| **`trailingBuyActivationPercent`** | **OVERRIDDEN**: Set to 0% (immediate consideration instead of waiting for price drop) | **YES**: Traditional mode waits for X% drop before considering buy. Momentum mode buys immediately on uptrend. These are opposing strategies. |
| **`trailingBuyReboundPercent`** | **BYPASSED**: Not used in momentum mode since there's no "bottom tracking" - buys happen on upward movement | **SOMEWHAT**: Rebound implies price going up from a bottom. Momentum buys on continuous strength, not rebounds. |
| **`maxLots`** | **OVERRIDDEN**: Ignored in momentum mode - lots are unlimited (capital-limited only) | **YES**: Traditional mode limits position size via maxLots. Momentum mode allows unlimited lots (only limited by available capital). |
| **`gridIntervalPercent`** | **STILL USED**: Grid spacing still applies for determining buy price thresholds | **NO**: Both modes use grid spacing, just triggered differently. |
| **Position P/L condition** | **NEW REQUIREMENT**: In momentum mode, position P/L > 0 required for buys (except first buy) | **N/A**: This is a new condition added by momentum mode. |
| **`profitRequirement`** | **STILL ENFORCED**: Sell profit requirement still applies in momentum mode | **NO**: Both modes require minimum profit for sells. |
| **`momentumBasedSell`** | **COMPLEMENTARY**: Often used together for full momentum strategy | **NO**: These work together, not against each other. |
| **Capital availability** | **MORE CRITICAL**: Since maxLots is unlimited, capital becomes the only limiting factor | **N/A**: Capital is always a limit, but becomes the primary constraint in momentum mode. |
| **First buy logic** | **EXCEPTION**: First buy doesn't require P/L > 0 (no position yet to evaluate) | **N/A**: Special case for momentum mode initialization. |

### Key Insights from This Analysis

1. **Direct Overrides**:
   - `trailingBuyActivationPercent`: 0% in momentum mode (documented in code and help text)
   - `maxLots`: Unlimited in momentum mode (documented in spec)

2. **Logical Contradictions**:
   - Traditional DCA (buy on weakness) vs Momentum (buy on strength) are fundamentally opposing strategies
   - Should NOT be presented as compatible strategies in UI
   - Consider adding UI warning if users try to enable both traditional trailing stops AND momentum mode

3. **New Conditions Introduced**:
   - P/L > 0 requirement for buys (except first)
   - Capital becomes sole limiting factor (not maxLots)

4. **Documentation Needed**:
   - Help text must explain that `trailingBuyActivationPercent` is overridden
   - Help text must explain that `maxLots` is ignored
   - Spec must document P/L gating behavior

## Example 2: `enableConsecutiveIncrementalBuyGrid` (Boolean - Spec 31)

**Parameter Type**: Boolean (feature flag)
**Purpose**: Enable grid spacing that widens with each consecutive buy
**Default**: `false`

### Parameter Relationships Table

| Parameter/Condition | Affected by `enableConsecutiveIncrementalBuyGrid` | Contradictory to `enableConsecutiveIncrementalBuyGrid` |
|---------------------|--------------------------------------------------|-------------------------------------------------------|
| **`gridIntervalPercent`** | **USED AS BASE**: Becomes the base interval, multiplied by `incrementalGridMultiplier^n` for nth buy | **NO**: Works with grid interval, doesn't contradict it. |
| **`incrementalGridMultiplier`** | **REQUIRED**: Only relevant when incremental grid is enabled | **NO**: This is the companion parameter. |
| **`enableDynamicGrid`** | **POTENTIAL CONFLICT**: Both modify grid spacing dynamically. May produce unexpected results if both enabled. | **MAYBE**: Both change grid spacing, but via different mechanisms. Could conflict or compound. Needs testing. |
| **`enableAverageBasedGrid`** | **POTENTIAL CONFLICT**: Average-based grid uses different calculation. Combining may be unpredictable. | **MAYBE**: Different grid calculation methods. Precedence unclear. |
| **Number of consecutive buys** | **DETERMINES MULTIPLIER**: Grid width = gridInterval × multiplier^(buyCount) | **N/A**: This is how the feature works. |
| **`maxLots`** | **INTERACTION**: Wider grids may mean fewer buys before hitting maxLots during extended downtrends | **NO**: But affects how quickly maxLots is reached. |
| **Price volatility** | **MORE SENSITIVE**: High volatility + wide grids may miss buy opportunities | **N/A**: Environmental factor, not parameter conflict. |

### Key Insights from This Analysis

1. **Potential Conflicts**:
   - `enableDynamicGrid`: Both modify grid spacing - need to define precedence
   - `enableAverageBasedGrid`: Both change grid calculation - need to define precedence
   - **RECOMMENDATION**: Make these mutually exclusive (disable others when one is enabled)

2. **Companion Parameters**:
   - `incrementalGridMultiplier`: Required for this feature to work
   - Should be shown/hidden in UI based on `enableConsecutiveIncrementalBuyGrid` state

3. **Interaction Effects**:
   - With `maxLots`: Wider grids = fewer buys = may not reach maxLots
   - Need to document this behavior in help text

4. **Documentation Needed**:
   - Explain that grid starts at base and widens with each buy
   - Warn about potential conflicts with other grid modification features
   - Document formula: `gridInterval × multiplier^buyCount`

## Template for New Parameters

When adding a new parameter, copy this template and fill it in:

```markdown
## Parameter Relationship Analysis: `[parameterName]`

**Parameter Type**: [Boolean/Number/Percentage/String]
**Purpose**: [Brief description of what parameter does]
**Default**: [Default value]
**Spec**: [Spec number if applicable]

### Parameter Relationships Table

| Parameter/Condition | Affected by `[parameterName]` | Contradictory to `[parameterName]` |
|---------------------|------------------------------|-----------------------------------|
| **`relatedParam1`** | [How is it affected?] | [Is there a conflict?] |
| **`relatedParam2`** | [How is it affected?] | [Is there a conflict?] |
| **`relatedParam3`** | [How is it affected?] | [Is there a conflict?] |
| **[Condition/State]** | [How is it affected?] | [Is there a conflict?] |

### Key Insights from This Analysis

1. **Direct Overrides**:
   - List parameters that are overridden or bypassed
   - Document the override behavior clearly

2. **Logical Contradictions**:
   - List parameters that conflict
   - Recommend UI handling (warnings, mutual exclusion, etc.)

3. **New Conditions Introduced**:
   - List new runtime conditions or requirements
   - Document initialization and edge cases

4. **Interaction Effects**:
   - List subtle interactions with other parameters
   - Document compound effects

5. **Documentation Needed**:
   - List what must be explained in help text
   - List what must be documented in spec
   - List what must be shown in UI warnings

### Recommendations

**UI Changes**:
- [ ] Add warning when conflicting parameters are both enabled
- [ ] Make certain parameters mutually exclusive (radio buttons instead of checkboxes)
- [ ] Show/hide related parameters based on this parameter's state
- [ ] Add help text explaining overrides and conflicts

**Code Changes**:
- [ ] Add validation to prevent invalid parameter combinations
- [ ] Add logging when parameters override each other
- [ ] Document precedence rules in comments

**Testing**:
- [ ] Test with all related parameters enabled
- [ ] Test with conflicting parameters enabled
- [ ] Test edge cases (first buy, no capital, maxLots reached, etc.)
- [ ] Verify override behavior works as documented
```

## How to Use This Framework

### Step 1: Identify Related Parameters

Ask yourself:
- What parameters affect the same execution logic? (e.g., all buy-related parameters)
- What parameters modify the same thresholds? (e.g., grid spacing parameters)
- What parameters could be used instead of this one? (alternative strategies)
- What conditions does this parameter introduce or modify?

### Step 2: Fill in the "Affected by" Column

For each related parameter, describe:
- Does your parameter **override** its value?
- Does your parameter **bypass** its logic?
- Does your parameter **enhance** or **reduce** its effect?
- Does your parameter **change** when/how it's evaluated?

**Use clear action verbs**: OVERRIDDEN, BYPASSED, MODIFIED, ENHANCED, IGNORED, STILL USED, etc.

### Step 3: Fill in the "Contradictory to" Column

For each related parameter, answer:
- Would enabling both create opposing behaviors? (**YES**)
- Would enabling both create ambiguous precedence? (**MAYBE**)
- Do they work together harmoniously? (**NO**)

**For YES or MAYBE**: Explain the conflict and recommend how to handle it.

### Step 4: Extract Insights

Based on your table, identify:
1. **What must be documented** (overrides, conflicts, precedence)
2. **What UI changes are needed** (warnings, mutual exclusion, help text)
3. **What validation is needed** (prevent invalid combinations)
4. **What testing is needed** (parameter combinations, edge cases)

### Step 5: Update Code and Documentation

Use insights to:
- Add clear comments in code explaining parameter interactions
- Update help text explaining what gets overridden
- Add UI warnings for conflicting parameters
- Create tests for parameter combinations
- Document in spec's requirements and design sections

## Common Parameter Relationship Patterns

### Pattern 1: Override Relationship

**Example**: `momentumBasedBuy` overrides `trailingBuyActivationPercent`

**Characteristics**:
- New parameter completely replaces old parameter's value/behavior
- Old parameter is ignored when new parameter is enabled
- Usually documented explicitly

**Handling**:
- Help text MUST mention the override
- Consider greying out overridden parameter in UI
- Add comment in code: `// NOTE: Overridden by [param] when enabled`

### Pattern 2: Mutual Exclusion

**Example**: `enableDynamicGrid` vs `enableAverageBasedGrid` vs `enableConsecutiveIncrementalBuyGrid`

**Characteristics**:
- Multiple parameters that modify the same thing in different ways
- Using more than one creates ambiguous behavior
- Should not be enabled simultaneously

**Handling**:
- Use radio buttons instead of checkboxes
- Add validation to reject requests with multiple enabled
- Show warning if user tries to enable multiple

### Pattern 3: Companion Parameters

**Example**: `enableConsecutiveIncrementalBuyGrid` + `incrementalGridMultiplier`

**Characteristics**:
- One parameter requires another to function
- Secondary parameter is only relevant when primary is enabled
- Not contradictory, but dependent

**Handling**:
- Show/hide secondary parameter in UI based on primary
- Document the dependency clearly
- Provide sensible default for secondary parameter

### Pattern 4: Compound Effects

**Example**: `gridIntervalPercent` + `enableConsecutiveIncrementalBuyGrid` + `incrementalGridMultiplier`

**Characteristics**:
- Multiple parameters work together to create combined effect
- Effect is multiplicative or additive, not contradictory
- Need to understand the compound behavior

**Handling**:
- Document the formula/calculation clearly
- Provide examples showing compound effect
- Test edge cases with extreme values

### Pattern 5: Condition Introduction

**Example**: `momentumBasedBuy` introduces "P/L > 0" requirement

**Characteristics**:
- New parameter adds new runtime conditions
- Conditions may have exceptions (e.g., first buy)
- Affects execution flow significantly

**Handling**:
- Document new conditions clearly in spec
- Add logging when conditions block actions
- Test edge cases thoroughly (initialization, no position, etc.)

## Checklist: Parameter Relationship Analysis

Before finalizing a new parameter implementation:

- [ ] Created parameter relationship table with all related parameters
- [ ] Identified all direct overrides (parameters that are bypassed/ignored)
- [ ] Identified all logical contradictions (conflicting strategies)
- [ ] Identified all companion parameters (dependencies)
- [ ] Identified all compound effects (interactions)
- [ ] Identified all new conditions introduced
- [ ] Documented overrides in help text
- [ ] Documented conflicts in help text
- [ ] Added UI warnings for conflicting combinations
- [ ] Made mutually exclusive parameters use radio buttons (if applicable)
- [ ] Added code comments explaining precedence rules
- [ ] Added validation to prevent invalid combinations
- [ ] Created tests for all parameter combinations
- [ ] Tested edge cases with conflicting parameters enabled
- [ ] Updated spec with parameter relationship section

## Integration with Other Sections

This analysis should inform:

- **G01/02 (Backend)**: Add validation code to handle conflicts
- **G01/03 (Configuration)**: Document default combinations that work well
- **G01/04 (Frontend)**: Add UI warnings, mutual exclusion, show/hide logic
- **G01/06 (Testing)**: Test parameter combinations and conflicts
- **Spec Requirements**: Document parameter relationships and precedence
- **Spec Design**: Show how parameters interact in execution flow

## Summary

Parameter relationship analysis is **critical** for:
1. **Preventing bugs** from unintended interactions
2. **Avoiding user confusion** about which parameter takes precedence
3. **Documenting behavior** clearly in help text and specs
4. **Testing thoroughly** with all relevant combinations

**Always complete this analysis before finalizing a new parameter implementation.**

The examples provided (`momentumBasedBuy` and `enableConsecutiveIncrementalBuyGrid`) serve as templates showing how to identify and document parameter relationships for any new parameter you add to the system.
