const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config/backtestDefaults.json');

class BacktestConfig {
  constructor() {
    this.defaults = this.loadDefaults();
  }

  loadDefaults() {
    try {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Could not load backtest defaults, using fallback values:', error.message);
      return {
        symbol: "NVDA",
        startDate: "2021-09-01",
        endDate: "2023-09-01",
        lotSizeUsd: 10000,
        maxLots: 5,
        gridIntervalPercent: 0.10,
        remainingLotsLossTolerance: 0.05
      };
    }
  }

  getDefaults() {
    return { ...this.defaults };
  }

  saveDefaults(newDefaults) {
    try {
      this.defaults = { ...this.defaults, ...newDefaults };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.defaults, null, 2));
      console.log('✅ Saved backtest defaults to:', CONFIG_FILE);
      return true;
    } catch (error) {
      console.error('❌ Failed to save backtest defaults:', error.message);
      return false;
    }
  }

  mergeWithDefaults(params) {
    return {
      ...this.defaults,
      ...params
    };
  }
}

module.exports = new BacktestConfig();