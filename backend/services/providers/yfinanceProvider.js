const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class YFinanceProvider {
  constructor() {
    this.name = 'yfinance';
  }

  async fetchDailyPrices(symbol) {
    try {
      console.log(`📡 YFinance: Fetching daily prices for ${symbol}`);

      const pythonScript = `
import yfinance as yf
import json
import sys

try:
    ticker = yf.Ticker("${symbol}")
    hist = ticker.history(period="5y")  # Get 5 years of data

    prices = []
    for date, row in hist.iterrows():
        prices.append({
            "date": date.strftime("%Y-%m-%d"),
            "open": float(row['Open']),
            "high": float(row['High']),
            "low": float(row['Low']),
            "close": float(row['Close']),
            "volume": int(row['Volume']),
            "adjusted_close": float(row['Adj Close'])
        })

    print(json.dumps(prices))

except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

      const pythonData = await this.runPythonScript(pythonScript);
      const prices = JSON.parse(pythonData);

      console.log(`✅ YFinance: Fetched ${prices.length} price records for ${symbol}`);
      return prices;

    } catch (error) {
      console.error(`❌ YFinance error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      console.log(`📡 YFinance: Fetching fundamentals for ${symbol}`);

      const pythonScript = `
import yfinance as yf
import json
import sys
import pandas as pd

try:
    ticker = yf.Ticker("${symbol}")

    # Get quarterly financials
    quarterly_financials = ticker.quarterly_financials
    quarterly_balance_sheet = ticker.quarterly_balance_sheet
    quarterly_cashflow = ticker.quarterly_cashflow

    fundamentals = []

    if not quarterly_financials.empty:
        for date in quarterly_financials.columns:
            try:
                revenue = quarterly_financials.loc['Total Revenue', date] if 'Total Revenue' in quarterly_financials.index else None
                net_income = quarterly_financials.loc['Net Income', date] if 'Net Income' in quarterly_financials.index else None

                # Convert numpy types to Python native types
                revenue = float(revenue) if pd.notna(revenue) else None
                net_income = float(net_income) if pd.notna(net_income) else None

                fundamentals.append({
                    "period_ending": date.strftime("%Y-%m-%d"),
                    "fiscal_date_ending": date.strftime("%Y-%m-%d"),
                    "reported_date": None,  # Yahoo doesn't provide this
                    "revenue": revenue,
                    "net_income": net_income,
                    "eps": None,  # Would need shares outstanding to calculate
                    "gross_profit": None
                })
            except Exception as e:
                continue

    print(json.dumps(fundamentals))

except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    print("[]")  # Return empty array on error
`;

      const pythonData = await this.runPythonScript(pythonScript);
      const fundamentals = JSON.parse(pythonData);

      console.log(`✅ YFinance: Fetched ${fundamentals.length} fundamental records for ${symbol}`);
      return fundamentals;

    } catch (error) {
      console.error(`❌ YFinance fundamentals error for ${symbol}:`, error.message);
      return []; // Return empty array instead of throwing
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      console.log(`📡 YFinance: Fetching corporate actions for ${symbol}`);

      const pythonScript = `
import yfinance as yf
import json
import sys

try:
    ticker = yf.Ticker("${symbol}")

    # Get splits and dividends
    splits = ticker.splits
    dividends = ticker.dividends

    actions = []

    # Process stock splits
    for date, ratio in splits.items():
        if ratio != 1.0:  # Only include actual splits
            actions.append({
                "date": date.strftime("%Y-%m-%d"),
                "action": "split",
                "ratio": float(ratio),
                "dividend": 0
            })

    # Process dividends
    for date, amount in dividends.items():
        actions.append({
            "date": date.strftime("%Y-%m-%d"),
            "action": "dividend",
            "ratio": 1,
            "dividend": float(amount)
        })

    print(json.dumps(actions))

except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    print("[]")  # Return empty array on error
`;

      const pythonData = await this.runPythonScript(pythonScript);
      const actions = JSON.parse(pythonData);

      console.log(`✅ YFinance: Fetched ${actions.length} corporate actions for ${symbol}`);
      return actions;

    } catch (error) {
      console.error(`❌ YFinance corporate actions error for ${symbol}:`, error.message);
      return []; // Return empty array instead of throwing
    }
  }

  runPythonScript(script) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start python: ${error.message}`));
      });
    });
  }
}

module.exports = YFinanceProvider;