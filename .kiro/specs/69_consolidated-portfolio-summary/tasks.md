# Spec 69: Implementation Tasks

## Task 1: Create PortfolioComparisonSummary Component
- [ ] Create `frontend/src/components/PortfolioComparisonSummary.js`
- [ ] Implement SummaryHeader sub-component (DCA vs B&H cards)
- [ ] Implement ComparisonTable sub-component with 5 columns
- [ ] Implement PortfolioActivityFooter sub-component
- [ ] Add helper functions for formatting (currency, percent, ratio)
- [ ] Add getAdvantageClass logic for color coding

## Task 2: Create CSS Styling
- [ ] Create `frontend/src/components/PortfolioComparisonSummary.css`
- [ ] Style summary header with strategy cards and vs divider
- [ ] Style comparison table with category headers
- [ ] Style winner/loser cells with green/red backgrounds
- [ ] Style advantage badges
- [ ] Style portfolio activity footer as horizontal grid
- [ ] Add responsive breakpoints for mobile

## Task 3: Integrate into PortfolioResults
- [ ] Import PortfolioComparisonSummary in PortfolioResults.js
- [ ] Replace PortfolioSummaryCard and PortfolioBuyAndHoldComparison
- [ ] Pass required props: portfolioSummary, comparison, buyAndHoldSummary
- [ ] Pass stockCount from stockResults.length
- [ ] Pass deferredSellsCount from deferredSells.length
- [ ] Remove the separate buy-hold-comparison-section

## Task 4: Handle Edge Cases
- [ ] Handle missing comparison data gracefully
- [ ] Handle missing buyAndHoldSummary gracefully
- [ ] Show N/A for unavailable metrics (Sortino, Calmar if not in data)
- [ ] Handle zero values appropriately

## Task 5: Testing
- [ ] Test with high_beta_largecap_v2 config (90% tab)
- [ ] Test with mag7_beta_scaled_converged config
- [ ] Verify all metrics display correctly
- [ ] Verify color coding shows correct advantage
- [ ] Verify responsive design on mobile viewport
- [ ] Verify portfolio activity metrics are accurate

## Task 6: Cleanup (Optional)
- [ ] Add deprecation comment to PortfolioSummaryCard.js
- [ ] Add deprecation comment to PortfolioBuyAndHoldComparison.js
- [ ] Verify no other components depend on deprecated components

## Verification URLs

```bash
# Test with high beta large cap (90% scenario)
http://localhost:3000/portfolio-backtest?config=high_beta_largecap_v2

# Test with Mag 7 converged
http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_converged

# Test with Mag 7 rounded
http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_rounded
```

## Acceptance Criteria

1. [ ] Single consolidated section at top of results
2. [ ] DCA vs B&H header with outperformance badge
3. [ ] 5-column comparison table with category grouping
4. [ ] Green background for winning metric values
5. [ ] Red background for losing metric values
6. [ ] Portfolio activity footer with 6 DCA-only metrics
7. [ ] Responsive design works on mobile
8. [ ] No regression in existing functionality
