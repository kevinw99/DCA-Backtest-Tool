#!/usr/bin/env python3
"""
Fetch current intraday price for a stock symbol using yfinance.
Returns synthetic OHLC bar for today constructed from intraday data.

Usage:
    python3 fetch_current_price.py SYMBOL

Output (JSON):
{
  "date": "2025-10-17",
  "open": 248.10,
  "high": 249.50,
  "low": 247.80,
  "close": 248.95,
  "volume": 15234567,
  "adjusted_close": 248.95,
  "is_current_intraday": true
}
"""

import sys
import json
import yfinance as yf
from datetime import datetime
import pytz

def fetch_current_price(symbol):
    """
    Fetch current intraday price and construct synthetic OHLC bar
    """
    try:
        # Create ticker object
        ticker = yf.Ticker(symbol)

        # Get today's intraday data (1-minute intervals)
        # This returns data from market open until now
        intraday = ticker.history(period='1d', interval='1m')

        if intraday.empty:
            # No intraday data available (market closed or symbol not found)
            return None

        # Get current ET time
        et_tz = pytz.timezone('America/New_York')
        now_et = datetime.now(et_tz)

        # Extract latest price as close
        latest_row = intraday.iloc[-1]
        current_price = float(latest_row['Close'])

        # Construct synthetic OHLC bar from intraday data
        today_open = float(intraday.iloc[0]['Open'])
        today_high = float(intraday['High'].max())
        today_low = float(intraday['Low'].min())
        today_close = current_price
        today_volume = int(intraday['Volume'].sum())

        # Create synthetic daily bar
        price_data = {
            'date': now_et.strftime('%Y-%m-%d'),
            'open': today_open,
            'high': today_high,
            'low': today_low,
            'close': today_close,
            'volume': today_volume,
            'adjusted_close': today_close,  # For current day, close = adjusted_close
            'is_current_intraday': True
        }

        return price_data

    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_current_price.py SYMBOL", file=sys.stderr)
        sys.exit(1)

    symbol = sys.argv[1].upper()

    price_data = fetch_current_price(symbol)

    if price_data:
        # Output JSON to stdout
        print(json.dumps(price_data))
        sys.exit(0)
    else:
        print(f"Failed to fetch current price for {symbol}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
