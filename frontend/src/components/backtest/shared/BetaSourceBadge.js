/**
 * BetaSourceBadge - Color-coded badge indicating beta value source
 *
 * Sources:
 * - file: From backtestDefaults.json (user-defined override) - Blue
 * - cache: From database cache (fresh) - Green
 * - live: Freshly fetched from provider - Yellow
 * - default: No data available, using 1.0 - Gray
 */

import React from 'react';

export const BetaSourceBadge = ({ source, isStale = false }) => {
  const config = {
    file: {
      label: 'File',
      color: 'blue',
      title: 'From backtestDefaults.json (user-defined override)'
    },
    cache: {
      label: 'Cache',
      color: 'green',
      title: 'Cached from provider (fresh data)'
    },
    live: {
      label: 'Live',
      color: 'yellow',
      title: 'Freshly fetched from provider'
    },
    yahoo_finance: {
      label: 'Live',
      color: 'yellow',
      title: 'Freshly fetched from Yahoo Finance'
    },
    alpha_vantage: {
      label: 'Live',
      color: 'yellow',
      title: 'Freshly fetched from Alpha Vantage'
    },
    default: {
      label: 'Default',
      color: 'gray',
      title: 'No data available, using default beta (1.0)'
    }
  };

  const sourceConfig = config[source] || config.default;
  const { label, color, title } = sourceConfig;

  const className = `beta-source-badge badge-${color}${isStale ? ' stale' : ''}`;

  return (
    <span className={className} title={title}>
      {label}
      {isStale && ' (Stale)'}
    </span>
  );
};

export default BetaSourceBadge;
