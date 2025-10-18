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

  // Calculate sensible defaults based on total capital
  const defaultCashYieldMinimum = Math.max(10000, totalCapital * 0.1); // 10% of capital or $10K minimum
  const defaultDeferredSellingThreshold = totalCapital * 0.3; // 30% of capital
  const defaultAdaptiveLotThreshold = totalCapital * 0.2; // 20% of capital

  return (
    <section className={`backtest-section capital-optimization ${className}`}>
      <SectionHeader
        icon={DollarSign}
        title="Capital Optimization"
        subtitle="Maximize returns on idle cash"
      />

      {/* Cash Yield Strategy */}
      <div className="strategy-group">
        <label className="strategy-header">
          <input
            type="checkbox"
            checked={parameters.enableCashYield || false}
            onChange={(e) => handleChange('enableCashYield', e.target.checked)}
          />
          <strong>Cash Yield Strategy</strong>
          <span className="help-text">Earn money market returns (4-5% annual) on idle cash reserves</span>
        </label>

        {parameters.enableCashYield && (
          <div className="parameter-grid strategy-params">
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
      <div className="strategy-group">
        <label className="strategy-header">
          <input
            type="checkbox"
            checked={parameters.enableDeferredSelling || false}
            onChange={(e) => handleChange('enableDeferredSelling', e.target.checked)}
          />
          <strong>Deferred Selling Strategy</strong>
          <span className="help-text">Skip profit-taking sells when cash reserves are high - let winners run!</span>
        </label>

        {parameters.enableDeferredSelling && (
          <div className="parameter-grid strategy-params">
            <ParameterInput
              label="Cash Abundance Threshold ($)"
              value={parameters.deferredSellingThreshold || defaultDeferredSellingThreshold}
              onChange={(val) => handleChange('deferredSellingThreshold', val)}
              type="number"
              step="10000"
              min="0"
              helpText={`Skip sells when cash exceeds this amount (default: ${(defaultDeferredSellingThreshold).toLocaleString()})`}
              error={getError('deferredSellingThreshold')}
            />
          </div>
        )}
      </div>

      {/* Adaptive Lot Sizing Strategy */}
      <div className="strategy-group">
        <label className="strategy-header">
          <input
            type="checkbox"
            checked={parameters.enableAdaptiveLotSizing || false}
            onChange={(e) => handleChange('enableAdaptiveLotSizing', e.target.checked)}
          />
          <strong>Adaptive Lot Sizing</strong>
          <span className="help-text">Increase lot sizes when excess cash is available</span>
        </label>

        {parameters.enableAdaptiveLotSizing && (
          <div className="parameter-grid strategy-params">
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

      <style jsx>{`
        .strategy-group {
          margin-bottom: 1.5rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fafafa;
        }

        .strategy-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
          cursor: pointer;
        }

        .strategy-header input[type="checkbox"] {
          margin-top: 0.2rem;
        }

        .strategy-header strong {
          color: #1f2937;
          font-size: 1rem;
        }

        .strategy-params {
          margin-top: 1rem;
          padding-left: 2rem;
          background: white;
          padding: 1rem;
          border-radius: 6px;
        }

        .help-text {
          display: block;
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }
      `}</style>
    </section>
  );
};

export default CapitalOptimizationSection;
