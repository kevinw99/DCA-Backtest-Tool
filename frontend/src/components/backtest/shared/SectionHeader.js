/**
 * SectionHeader - Consistent section header for backtest forms
 */

import React from 'react';

export const SectionHeader = ({ icon: Icon, title, subtitle, children }) => {
  return (
    <div className="section-header">
      <h3>
        {Icon && <Icon size={20} />}
        <span className="title">{title}</span>
      </h3>
      {subtitle && <span className="subtitle">{subtitle}</span>}
      {children}
    </div>
  );
};

export default SectionHeader;
