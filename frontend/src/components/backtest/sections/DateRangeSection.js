/**
 * DateRangeSection - Date range parameters for backtesting
 *
 * Handles start and end date selection.
 */

import React from 'react';
import { Calendar } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';

export const DateRangeSection = ({
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

  return (
    <section className={`backtest-section date-range ${className}`}>
      <SectionHeader
        icon={Calendar}
        title="Date Range"
      />

      <div className="parameter-grid">
        <ParameterInput
          label="Start Date"
          value={parameters.startDate || ''}
          onChange={(val) => handleChange('startDate', val)}
          type="date"
          helpText="Beginning date for backtest period"
          error={getError('startDate')}
        />

        <ParameterInput
          label="End Date"
          value={parameters.endDate || ''}
          onChange={(val) => handleChange('endDate', val)}
          type="date"
          helpText="Ending date for backtest period"
          error={getError('endDate')}
        />
      </div>
    </section>
  );
};

export default DateRangeSection;
