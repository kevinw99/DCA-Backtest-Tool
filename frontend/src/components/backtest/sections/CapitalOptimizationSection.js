/**
 * CapitalOptimizationSection - Capital optimization strategies
 *
 * Manages strategies to maximize idle cash utilization:
 * - Cash Yield: Money market returns on idle cash
 * - Deferred Selling: Skip sells when cash is abundant
 * - Adaptive Lot Sizing: Increase lot sizes when excess cash available
 */

import React from 'react';
import { DollarSign } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';

export const CapitalOptimizationSection = ({
  totalCapital,
  parameters,
  onParametersChange,
  validationErrors = [],
  className = ''
}) => {
  const handleChange = (field, value) => {
    onParametersChange({
      ...parameters,
      [field]: value
    });
  };

  const getError = (field) => {
    const error = validationErrors.find(e => e.field === field);
    return error ? error.message : null;
  };

  // Calculate sensible defaults based on lot size
  const lotSize = parameters.lotSizeUsd || 10000;
  const defaultCashYieldMinimum = Math.max(10000, totalCapital * 0.1); // 10% of capital or $10K minimum
  const defaultDeferredSellingThreshold = lotSize * 5; // 5x lot size
  const defaultAdaptiveLotThreshold = totalCapital * 0.2; // 20% of capital

  return (
    <section className={`backtest-section capital-optimization ${className}`}>
      <SectionHeader
        icon={DollarSign}
        title="Capital Optimization"
        subtitle="Maximize returns on idle cash"
      />

      <div className="checkbox-grid">
        {/* Cash Yield Strategy */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableCashYield || false}
              onChange={(e) => handleChange('enableCashYield', e.target.checked)}
            />
            Cash Yield Strategy
          </label>
          <span className="checkbox-description">Earn money market returns (4-5% annual) on idle cash reserves</span>

          {parameters.enableCashYield && (
            <div className="nested-control">
              <ParameterInput
                label="Annual Yield %"
                value={parameters.cashYieldAnnualPercent || 4.5}
                onChange={(val) => handleChange('cashYieldAnnualPercent', val)}
                type="number"
                step="0.1"
                min="0"
                max="10"
                helpText="Expected annual return on cash (e.g., money market fund)"
                error={getError('cashYieldAnnualPercent')}
              />
              <ParameterInput
                label="Minimum Cash to Invest ($)"
                value={parameters.cashYieldMinCash || defaultCashYieldMinimum}
                onChange={(val) => handleChange('cashYieldMinCash', val)}
                type="number"
                step="1000"
                min="0"
                helpText="Only invest cash above this threshold"
                error={getError('cashYieldMinCash')}
              />
            </div>
          )}
        </div>

        {/* Deferred Selling Strategy */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableDeferredSelling || false}
              onChange={(e) => handleChange('enableDeferredSelling', e.target.checked)}
            />
            Deferred Selling Strategy
          </label>
          <span className="checkbox-description">Skip profit-taking sells when cash reserves are high - let winners run!</span>

          {parameters.enableDeferredSelling && (
            <div className="nested-control">
              <ParameterInput
                label="Cash Abundance Threshold ($)"
                value={parameters.deferredSellingThreshold || defaultDeferredSellingThreshold}
                onChange={(val) => handleChange('deferredSellingThreshold', val)}
                type="number"
                step="10000"
                min="0"
                helpText={`Skip sells when cash exceeds this amount (default: ${(defaultDeferredSellingThreshold).toLocaleString()} = 5x lot size)`}
                error={getError('deferredSellingThreshold')}
              />
            </div>
          )}
        </div>

        {/* Optimized Total Capital (Spec 61) */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.optimizedTotalCapital || false}
              onChange={(e) => handleChange('optimizedTotalCapital', e.target.checked)}
            />
            Auto-Discover Optimal Capital
          </label>
          <span className="checkbox-description">
            Run multiple scenarios: find minimum capital needed (100%) and compare with constrained levels (90%, 80%, 70%)
          </span>

          {parameters.optimizedTotalCapital && (
            <div className="nested-control info-box">
              <p>Four scenarios will be generated:</p>
              <ul>
                <li><strong>Optimal (100%)</strong>: Exact capital needed for zero rejected orders</li>
                <li><strong>Constrained (90%)</strong>: Performance with 10% less capital</li>
                <li><strong>Constrained (80%)</strong>: Performance with 20% less capital</li>
                <li><strong>Constrained (70%)</strong>: Performance with 30% less capital</li>
              </ul>
              <p className="note">
                Total Capital setting above will be ignored - capital is auto-discovered.
              </p>
            </div>
          )}
        </div>

        {/* Adaptive Lot Sizing Strategy */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableAdaptiveLotSizing || false}
              onChange={(e) => handleChange('enableAdaptiveLotSizing', e.target.checked)}
            />
            Adaptive Lot Sizing
          </label>
          <span className="checkbox-description">Increase lot sizes when excess cash is available</span>

          {parameters.enableAdaptiveLotSizing && (
            <div className="nested-control">
              <ParameterInput
                label="Cash Reserve Threshold ($)"
                value={parameters.adaptiveLotCashThreshold || defaultAdaptiveLotThreshold}
                onChange={(val) => handleChange('adaptiveLotCashThreshold', val)}
                type="number"
                step="10000"
                min="0"
                helpText="Start increasing lot sizes when cash exceeds this"
                error={getError('adaptiveLotCashThreshold')}
              />
              <ParameterInput
                label="Max Lot Size Multiplier"
                value={parameters.adaptiveLotMaxMultiplier || 2.0}
                onChange={(val) => handleChange('adaptiveLotMaxMultiplier', val)}
                type="number"
                step="0.1"
                min="1"
                max="5"
                helpText="Maximum factor to increase lot sizes (e.g., 2x = double)"
                error={getError('adaptiveLotMaxMultiplier')}
              />
              <ParameterInput
                label="Increase Step %"
                value={parameters.adaptiveLotIncreaseStep || 20}
                onChange={(val) => handleChange('adaptiveLotIncreaseStep', val)}
                type="number"
                step="5"
                min="0"
                max="100"
                helpText="Percentage increase per threshold of excess cash"
                error={getError('adaptiveLotIncreaseStep')}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CapitalOptimizationSection;
