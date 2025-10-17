const axios = require('axios');

/**
 * Test script to check if Yahoo Finance API returns current intraday prices
 * during trading hours or only yesterday's closing price.
 */

async function testYahooCurrentPrice() {
  const symbol = 'AAPL'; // Test with Apple stock

  console.log('='.repeat(60));
  console.log('Testing Yahoo Finance API for Current Price Data');
  console.log('='.repeat(60));
  console.log(`Current Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`Testing Symbol: ${symbol}`);
  console.log('='.repeat(60));

  try {
    // Method 1: Using quote endpoint (v10)
    console.log('\n📊 Method 1: Quote Endpoint (v10)');
    console.log('-'.repeat(60));
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
    const quoteResponse = await axios.get(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const priceData = quoteResponse.data.quoteSummary.result[0].price;

    console.log('Price Data:');
    console.log(`  Regular Market Price: $${priceData.regularMarketPrice?.raw || 'N/A'}`);
    console.log(`  Regular Market Time: ${priceData.regularMarketTime ? new Date(priceData.regularMarketTime * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} ET`);
    console.log(`  Post Market Price: $${priceData.postMarketPrice?.raw || 'N/A'}`);
    console.log(`  Post Market Time: ${priceData.postMarketTime ? new Date(priceData.postMarketTime * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} ET`);
    console.log(`  Pre Market Price: $${priceData.preMarketPrice?.raw || 'N/A'}`);
    console.log(`  Pre Market Time: ${priceData.preMarketTime ? new Date(priceData.preMarketTime * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} ET`);
    console.log(`  Market State: ${priceData.marketState || 'N/A'}`);

    // Method 2: Using v8 chart endpoint for latest minute data
    console.log('\n\n📈 Method 2: Chart Endpoint (v8) - 1 Day, 1 Minute Interval');
    console.log('-'.repeat(60));
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;
    const chartResponse = await axios.get(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const chartData = chartResponse.data.chart.result[0];
    const timestamps = chartData.timestamp;
    const prices = chartData.indicators.quote[0].close;

    if (timestamps && timestamps.length > 0) {
      const latestIndex = timestamps.length - 1;
      const latestTimestamp = timestamps[latestIndex];
      const latestPrice = prices[latestIndex];

      console.log('Latest Intraday Data:');
      console.log(`  Latest Timestamp: ${new Date(latestTimestamp * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
      console.log(`  Latest Price: $${latestPrice}`);
      console.log(`  Total Data Points Today: ${timestamps.length}`);

      // Show last 5 data points
      console.log('\n  Last 5 Data Points:');
      for (let i = Math.max(0, timestamps.length - 5); i < timestamps.length; i++) {
        const time = new Date(timestamps[i] * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
        console.log(`    ${time} ET: $${prices[i]}`);
      }
    }

    // Method 3: Using v7 quote endpoint
    console.log('\n\n💹 Method 3: Quote Endpoint (v7)');
    console.log('-'.repeat(60));
    const v7QuoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const v7QuoteResponse = await axios.get(v7QuoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const quoteResult = v7QuoteResponse.data.quoteResponse.result[0];
    console.log('Quote Data:');
    console.log(`  Regular Market Price: $${quoteResult.regularMarketPrice || 'N/A'}`);
    console.log(`  Regular Market Time: ${quoteResult.regularMarketTime ? new Date(quoteResult.regularMarketTime * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} ET`);
    console.log(`  Market State: ${quoteResult.marketState || 'N/A'}`);
    console.log(`  Previous Close: $${quoteResult.regularMarketPreviousClose || 'N/A'}`);

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const now = new Date();
    const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const currentHour = nowET.getHours();
    const currentMinute = nowET.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Market hours: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
    const marketOpen = 9 * 60 + 30; // 570
    const marketClose = 16 * 60; // 960

    const isMarketHours = currentTime >= marketOpen && currentTime < marketClose;

    console.log(`Current ET Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
    console.log(`Market Status: ${isMarketHours ? '🟢 OPEN (9:30 AM - 4:00 PM ET)' : '🔴 CLOSED'}`);

    if (priceData.regularMarketTime) {
      const priceAge = Math.floor((Date.now() - priceData.regularMarketTime * 1000) / 1000 / 60);
      console.log(`Price Age: ${priceAge} minutes old`);

      if (isMarketHours && priceAge < 5) {
        console.log('✅ Yahoo API provides CURRENT intraday prices during market hours');
      } else if (isMarketHours && priceAge > 60) {
        console.log('⚠️  Yahoo API appears delayed or showing previous close');
      } else if (!isMarketHours) {
        console.log('ℹ️  Market is closed - showing last close price');
      }
    }

  } catch (error) {
    console.error('\n❌ Error testing Yahoo Finance API:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${error.response.statusText}`);
    } else {
      console.error(`  ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Run the test
testYahooCurrentPrice();
