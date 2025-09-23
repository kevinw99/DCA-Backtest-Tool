const axios = require('axios');

class AlphaVantageProvider {
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.requestQueue = [];
    this.isProcessing = false;
    
    if (!this.apiKey) {
      console.warn('Warning: ALPHA_VANTAGE_API_KEY not set. API calls will fail.');
    }
  }

  // Rate limiting: 5 requests per minute
  async makeRateLimitedRequest(config) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ config, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    const requestsPerMinute = 5;
    const delayBetweenRequests = 60000 / requestsPerMinute; // 12 seconds between requests
    
    while (this.requestQueue.length > 0) {
      const { config, resolve, reject } = this.requestQueue.shift();
      
      try {
        console.log(`Making Alpha Vantage API request: ${config.params.function} for ${config.params.symbol} (${this.requestQueue.length} remaining in queue)`);
        const response = await axios.get(this.baseUrl, config);
        
        // Debug: Log response structure and first record
        console.log(`✅ Raw response received, status: ${response.status}`);
        
        try {
          console.log(`✅ Response data keys:`, Object.keys(response.data));
          if (response.data['Note']) {
            console.log(`⚠️  Rate limit note:`, response.data['Note']);
          }
          if (response.data['Error Message']) {
            console.log(`❌ API Error Message:`, response.data['Error Message']);
          }
          if (response.data['Information']) {
            console.log(`ℹ️  Information:`, response.data['Information']);
          }
        } catch (debugErr) {
          console.log(`❌ Error parsing response data:`, debugErr.message);
          console.log(`   Raw response:`, JSON.stringify(response.data).substring(0, 500));
        }
        
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      // Wait before next request to respect rate limit
      if (this.requestQueue.length > 0) {
        console.log(`Waiting ${delayBetweenRequests/1000}s for rate limit...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }
    
    this.isProcessing = false;
  }

  async fetchDailyPrices(symbol) {
    try {
      console.log(`🔄 Starting fetchDailyPrices for ${symbol}`);
      
      // Use Alpha Vantage's TIME_SERIES_DAILY_ADJUSTED to get split-adjusted prices
      // This provides both raw and adjusted close prices in a single API call
      const response = await this.makeRateLimitedRequest({
        params: {
          function: 'TIME_SERIES_DAILY_ADJUSTED',
          symbol: symbol,
          apikey: this.apiKey,
          outputsize: 'full'
        },
        timeout: 30000
      });

      console.log(`📈 Got adjusted price response for ${symbol}, status:`, response.status);
      
      // Debug: Log what we received FIRST - wrap in try/catch
      try {
        console.log(`📈 TIME_SERIES_DAILY_ADJUSTED response for ${symbol}:`);
        console.log(`   Response keys:`, Object.keys(response.data));
      } catch (debugError) {
        console.log(`❌ Error in debugging:`, debugError.message);
        console.log(`   Raw response:`, response);
      }
      
      if (response.data['Error Message']) {
        console.log(`   ❌ API Error:`, response.data['Error Message']);
        throw new Error(`Alpha Vantage API Error: ${response.data['Error Message']}`);
      }

      if (response.data['Note']) {
        console.log(`   ⚠️  Rate limit note:`, response.data['Note']);
        throw new Error('API call frequency limit reached. Please wait and try again.');
      }

      if (response.data['Information'] && response.data['Information'].includes('rate limit')) {
        console.log(`   ⚠️  Daily rate limit reached:`, response.data['Information']);
        throw new Error('Daily API rate limit reached. Please wait until tomorrow or upgrade your Alpha Vantage plan.');
      }

      const timeSeries = response.data['Time Series (Daily)'];
      
      if (timeSeries) {
        const dates = Object.keys(timeSeries);
        console.log(`   ✅ Time series dates count:`, dates.length);
        if (dates.length > 0) {
          console.log(`   Latest date:`, dates[0]);
          console.log(`   First price record:`, JSON.stringify(timeSeries[dates[0]], null, 2));
          
          // Show split adjustment info
          const sample = timeSeries[dates[0]];
          const rawClose = parseFloat(sample['4. close']);
          const adjClose = parseFloat(sample['5. adjusted close']);
          if (rawClose && adjClose && Math.abs(rawClose - adjClose) > 0.01) {
            console.log(`   📊 Split adjustment detected: Raw $${rawClose} -> Adjusted $${adjClose}`);
          }
        }
      } else {
        console.log(`   ❌ No 'Time Series (Daily)' found in response`);
        console.log(`   Full response:`, JSON.stringify(response.data, null, 2));
      }
      
      if (!timeSeries) {
        throw new Error('No time series data found in API response');
      }

      // Convert to our format and filter by date
      const pricesData = [];
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      Object.entries(timeSeries).forEach(([date, data]) => {
        const priceDate = new Date(date);
        
        if (priceDate >= fiveYearsAgo) {
          // Alpha Vantage provides both raw and split-adjusted prices
          const rawClose = parseFloat(data['4. close']) || null;
          const adjustedClose = parseFloat(data['5. adjusted close']) || null;
          const splitCoeff = parseFloat(data['8. split coefficient']) || 1;
          
          pricesData.push({
            date: date,
            open: parseFloat(data['1. open']) || null,
            high: parseFloat(data['2. high']) || null,
            low: parseFloat(data['3. low']) || null,
            close: rawClose, // Raw close price (pre-split)
            adjusted_close: adjustedClose, // Split-adjusted close price
            volume: parseInt(data['6. volume']) || null,
            dividend_amount: parseFloat(data['7. dividend amount']) || 0,
            split_coefficient: splitCoeff,
            // Mark as having both raw and adjusted data
            has_adjustments: true
          });
        }
      });

      // Sort by date ascending
      pricesData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`✅ Successfully processed ${pricesData.length} price records for ${symbol}`);
      console.log(`   Date range: ${pricesData[0]?.date} to ${pricesData[pricesData.length - 1]?.date}`);
      
      // Log split information if found
      const splitsFound = pricesData.filter(p => p.split_coefficient !== 1);
      if (splitsFound.length > 0) {
        console.log(`   📊 Split coefficients found on ${splitsFound.length} dates:`);
        splitsFound.slice(0, 3).forEach(s => {
          console.log(`     ${s.date}: coefficient ${s.split_coefficient}`);
        });
      }
      
      return pricesData;
    } catch (error) {
      console.error('Error fetching daily prices from Alpha Vantage:', error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      // Fetch income statement, earnings data, and earnings calendar (for real announcement dates)
      const incomeResponse = await axios.get(this.baseUrl, {
        params: {
          function: 'INCOME_STATEMENT',
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 30000
      });
      
      const earningsResponse = await axios.get(this.baseUrl, {
        params: {
          function: 'EARNINGS',
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 30000
      });

      // Process income statement data
      const quarterlyReports = incomeResponse.data.quarterlyReports || [];
      const earningsData = earningsResponse.data.quarterlyEarnings || [];
      
      // Debug: Log what we received
      console.log(`📊 INCOME_STATEMENT response for ${symbol}:`);
      console.log(`   Keys:`, Object.keys(incomeResponse.data));
      console.log(`   Quarterly reports count:`, quarterlyReports.length);
      
      console.log(`📈 EARNINGS response for ${symbol}:`);
      console.log(`   Keys:`, Object.keys(earningsResponse.data));
      console.log(`   Quarterly earnings count:`, earningsData.length);
      if (earningsData.length > 0) {
        console.log(`   First earnings record:`, JSON.stringify(earningsData[0], null, 2));
        console.log(`   🔍 reportedDate field:`, earningsData[0].reportedDate);
      }

      // Combine data by fiscal date
      const fundamentalsMap = new Map();

      // Process income statement data
      quarterlyReports.forEach(report => {
        const fiscalDate = report.fiscalDateEnding;
        if (!fiscalDate) return;

        // Only use reportedDate from income statement if available, otherwise skip
        const actualReportDate = report.reportedDate;

        fundamentalsMap.set(fiscalDate, {
          fiscal_date_ending: fiscalDate,
          reported_date: actualReportDate,
          revenue: this.parseNumber(report.totalRevenue),
          gross_profit: this.parseNumber(report.grossProfit),
          operating_income: this.parseNumber(report.operatingIncome),
          net_income: this.parseNumber(report.netIncome),
          shares_outstanding: null,
          eps: null
        });
      });

      // Add earnings data
      earningsData.forEach(earnings => {
        const fiscalDate = earnings.fiscalDateEnding;
        if (!fiscalDate) return;

        // Only use reportedDate from earnings data if available - no fallback to fiscal date
        const actualReportDate = earnings.reportedDate;

        const existing = fundamentalsMap.get(fiscalDate) || {
          fiscal_date_ending: fiscalDate,
          reported_date: actualReportDate
        };

        // Update reported_date with earnings data (takes precedence over income statement)
        existing.reported_date = actualReportDate;
        existing.eps = this.parseNumber(earnings.reportedEPS);
        existing.estimated_eps = this.parseNumber(earnings.estimatedEPS);
        
        // Calculate EPS surprise
        if (existing.eps && existing.estimated_eps) {
          existing.eps_surprise_amount = existing.eps - existing.estimated_eps;
          existing.eps_surprise_percent = ((existing.eps - existing.estimated_eps) / Math.abs(existing.estimated_eps)) * 100;
        }
        
        fundamentalsMap.set(fiscalDate, existing);
      });

      // Convert to array and filter last 5 years
      const fundamentalsData = Array.from(fundamentalsMap.values());
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const filteredData = fundamentalsData.filter(data => {
        const fiscalDate = new Date(data.fiscal_date_ending);
        return fiscalDate >= fiveYearsAgo;
      });

      return filteredData;
    } catch (error) {
      console.error('Error fetching quarterly fundamentals from Alpha Vantage:', error.message);
      throw error;
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      console.log(`🏢 Fetching corporate actions for ${symbol}`);
      
      // Get basic overview for recent split info
      const overviewResponse = await this.makeRateLimitedRequest({
        params: {
          function: 'OVERVIEW',
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 30000
      });

      const overview = overviewResponse.data;
      const corporateActions = [];

      console.log(`📊 Overview response keys:`, Object.keys(overview));
      if (overview.LastSplitDate) {
        console.log(`   Last split: ${overview.LastSplitDate} - ${overview.LastSplitFactor}`);
      }

      // Parse split information from overview (only most recent split)
      if (overview.LastSplitDate && overview.LastSplitFactor) {
        const splitDate = overview.LastSplitDate;
        const splitFactor = overview.LastSplitFactor;
        
        // Parse split ratio (e.g., "2:1" means 2 new shares for every 1 old share)
        const [newShares, oldShares] = splitFactor.split(':').map(s => parseFloat(s.trim()));
        if (newShares && oldShares) {
          // Adjustment factor for historical prices: multiply old prices by (old/new)
          // This makes historical prices smaller to maintain continuity
          const adjustmentFactor = oldShares / newShares;
          
          console.log(`   Split parsed: ${newShares}:${oldShares} ratio, adjustment factor: ${adjustmentFactor}`);
          
          corporateActions.push({
            action_date: splitDate,
            action_type: 'SPLIT',
            split_ratio: splitFactor,
            adjustment_factor: adjustmentFactor,
            description: `Stock split ${splitFactor} (${newShares} new shares for ${oldShares} old)`
          });
        }
      }

      // Additional split detection from Alpha Vantage's overview data could be enhanced
      // but for now we'll rely primarily on the official LastSplitDate information
      // and price gap analysis from the stock service

      // Remove duplicates and sort by date
      const uniqueActions = corporateActions.filter((action, index, self) => 
        index === self.findIndex(a => a.action_date === action.action_date && a.action_type === action.action_type)
      ).sort((a, b) => new Date(a.action_date) - new Date(b.action_date));

      console.log(`✅ Found ${uniqueActions.length} corporate actions for ${symbol}`);
      uniqueActions.forEach(action => {
        console.log(`   ${action.action_date}: ${action.action_type} ${action.split_ratio} (factor: ${action.adjustment_factor})`);
      });

      return uniqueActions;
    } catch (error) {
      console.error('Error fetching corporate actions from Alpha Vantage:', error.message);
      return []; // Corporate actions are optional
    }
  }


  parseNumber(value) {
    if (!value || value === 'None' || value === 'null') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

module.exports = AlphaVantageProvider;