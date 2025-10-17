#!/usr/bin/env python3
"""
Test script to check if Yahoo Finance (yfinance) returns current intraday prices
during trading hours or only yesterday's closing price.
"""

import yfinance as yf
from datetime import datetime, timezone
import pytz

def test_current_price():
    symbol = "AAPL"  # Test with Apple stock

    print("=" * 70)
    print("Testing Yahoo Finance (yfinance) for Current Price Data")
    print("=" * 70)

    # Get current time in ET
    et_tz = pytz.timezone('America/New_York')
    now_et = datetime.now(et_tz)
    print(f"Current Time (ET): {now_et.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"Testing Symbol: {symbol}")
    print("=" * 70)

    # Create ticker object
    ticker = yf.Ticker(symbol)

    # Method 1: Get info (current/most recent price)
    print("\n📊 Method 1: ticker.info (General Info)")
    print("-" * 70)
    try:
        info = ticker.info
        if 'currentPrice' in info:
            print(f"  Current Price: ${info['currentPrice']}")
        if 'regularMarketPrice' in info:
            print(f"  Regular Market Price: ${info['regularMarketPrice']}")
        if 'previousClose' in info:
            print(f"  Previous Close: ${info['previousClose']}")
        if 'regularMarketTime' in info:
            market_time = datetime.fromtimestamp(info['regularMarketTime'], tz=et_tz)
            print(f"  Regular Market Time: {market_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    except Exception as e:
        print(f"  Error: {e}")

    # Method 2: Get 1 day history with 1 minute interval (intraday)
    print("\n\n📈 Method 2: ticker.history(period='1d', interval='1m') - Intraday")
    print("-" * 70)
    try:
        intraday = ticker.history(period='1d', interval='1m')
        if not intraday.empty:
            latest_row = intraday.iloc[-1]
            latest_time = intraday.index[-1]

            print(f"  Latest Timestamp: {latest_time.tz_convert(et_tz).strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print(f"  Latest Close Price: ${latest_row['Close']:.2f}")
            print(f"  Latest High: ${latest_row['High']:.2f}")
            print(f"  Latest Low: ${latest_row['Low']:.2f}")
            print(f"  Latest Volume: {int(latest_row['Volume']):,}")
            print(f"  Total Data Points Today: {len(intraday)}")

            # Show last 5 data points
            print("\n  Last 5 Minute Data Points:")
            for i in range(max(0, len(intraday) - 5), len(intraday)):
                row = intraday.iloc[i]
                time_str = intraday.index[i].tz_convert(et_tz).strftime('%H:%M:%S')
                print(f"    {time_str} ET: Open=${row['Open']:.2f}, Close=${row['Close']:.2f}, Vol={int(row['Volume']):,}")
        else:
            print("  No intraday data available (market may be closed)")
    except Exception as e:
        print(f"  Error: {e}")

    # Method 3: Get 5 day history with 1 day interval
    print("\n\n💹 Method 3: ticker.history(period='5d') - Daily")
    print("-" * 70)
    try:
        daily = ticker.history(period='5d')
        if not daily.empty:
            print(f"  Last {len(daily)} Trading Days:")
            for i in range(len(daily)):
                row = daily.iloc[i]
                date_str = daily.index[i].strftime('%Y-%m-%d')
                print(f"    {date_str}: Close=${row['Close']:.2f}, Volume={int(row['Volume']):,}")
        else:
            print("  No daily data available")
    except Exception as e:
        print(f"  Error: {e}")

    # Method 4: Fast method - get most recent price
    print("\n\n⚡ Method 4: ticker.fast_info (Fastest Method)")
    print("-" * 70)
    try:
        fast_info = ticker.fast_info
        print(f"  Last Price: ${fast_info.get('lastPrice', 'N/A')}")
        print(f"  Previous Close: ${fast_info.get('previousClose', 'N/A')}")
        print(f"  Open: ${fast_info.get('open', 'N/A')}")
        print(f"  Day High: ${fast_info.get('dayHigh', 'N/A')}")
        print(f"  Day Low: ${fast_info.get('dayLow', 'N/A')}")
    except Exception as e:
        print(f"  Error: {e}")

    # Summary
    print("\n\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    # Check if market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)
    current_hour = now_et.hour
    current_minute = now_et.minute
    weekday = now_et.weekday()  # 0=Monday, 6=Sunday

    market_open_time = 9 * 60 + 30  # 9:30 AM in minutes
    market_close_time = 16 * 60  # 4:00 PM in minutes
    current_time_minutes = current_hour * 60 + current_minute

    is_market_hours = (
        weekday < 5 and  # Monday-Friday
        current_time_minutes >= market_open_time and
        current_time_minutes < market_close_time
    )

    print(f"Current ET Time: {current_hour}:{current_minute:02d}")
    print(f"Day of Week: {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday]}")
    print(f"Market Status: {'🟢 OPEN (9:30 AM - 4:00 PM ET)' if is_market_hours else '🔴 CLOSED'}")

    # Calculate age of latest price
    try:
        if not intraday.empty:
            latest_time_utc = intraday.index[-1]
            now_utc = datetime.now(timezone.utc)
            price_age_seconds = (now_utc - latest_time_utc.tz_convert(timezone.utc)).total_seconds()
            price_age_minutes = int(price_age_seconds / 60)

            print(f"Latest Price Age: {price_age_minutes} minutes old")

            if is_market_hours and price_age_minutes < 5:
                print("✅ Yahoo Finance (yfinance) provides CURRENT intraday prices during market hours")
                print("   (Price is less than 5 minutes old)")
            elif is_market_hours and price_age_minutes >= 5 and price_age_minutes < 60:
                print("⚠️  Yahoo Finance price is slightly delayed (5-60 minutes)")
            elif is_market_hours and price_age_minutes >= 60:
                print("⚠️  Yahoo Finance appears to be showing outdated data or previous close")
            else:
                print("ℹ️  Market is closed - showing last available price from trading session")
    except Exception as e:
        print(f"Could not calculate price age: {e}")

    print("\n" + "=" * 70)
    print("CONCLUSION:")
    print("=" * 70)
    print("yfinance can provide:")
    print("  • Real-time/near-real-time prices during market hours (1-minute intervals)")
    print("  • Historical daily prices for backtesting")
    print("  • Both are suitable for different use cases:")
    print("    - Backtesting: Use daily history (ticker.history(period='5y'))")
    print("    - Live monitoring: Use intraday (ticker.history(period='1d', interval='1m'))")
    print("=" * 70)

if __name__ == "__main__":
    test_current_price()
