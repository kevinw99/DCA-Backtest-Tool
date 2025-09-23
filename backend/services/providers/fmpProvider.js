const axios = require('axios');

class FMPProvider {
  constructor() {
    this.apiKey = process.env.FMP_API_KEY;
    this.baseUrl = 'https://financialmodelingprep.com/api';
    
    if (!this.apiKey) {
      console.warn('Warning: FMP_API_KEY not set. Financial Modeling Prep API calls will fail.');
    }
  }

  async fetchDailyPrices(symbol) {
    try {
      console.log(`📡 FMP API: Daily prices for ${symbol}`);
      
      const response = await axios.get(`${this.baseUrl}/v3/historical-price-full/${symbol}`, {
        params: {
          apikey: this.apiKey
        },
        timeout: 30000
      });

      if (response.data.error) {
        throw new Error(`FMP API Error: ${response.data.error}`);
      }

      const historical = response.data.historical;
      if (!historical || historical.length === 0) {
        throw new Error('No historical price data found in FMP response');
      }

      // Convert FMP format to our format and filter last 5 years
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const pricesData = historical
        .filter(item => new Date(item.date) >= fiveYearsAgo)
        .map(item => ({
          date: item.date,
          open: item.open || null,
          high: item.high || null,
          low: item.low || null,
          close: item.close || null,
          volume: item.volume || null
        }));

      // Sort by date ascending (FMP returns newest first)
      pricesData.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log(`✅ Got ${pricesData.length} prices. Sample: ${pricesData[0]?.date} = $${pricesData[0]?.close}`);
      return pricesData;
    } catch (error) {
      console.error('Error fetching daily prices from FMP:', error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      console.log(`📡 FMP API: Fundamentals for ${symbol}`);

      // Log the exact API URLs being called
      const incomeUrl = `${this.baseUrl}/v3/income-statement/${symbol}?period=quarter&limit=40&apikey=${this.apiKey}`;
      const calendarUrl = `${this.baseUrl}/v3/historical/earning_calendar/${symbol}?apikey=${this.apiKey}`;
      const estimatesUrl = `${this.baseUrl}/v3/analyst-estimates/${symbol}?period=quarter&limit=40&apikey=${this.apiKey}`;
      const growthUrl = `${this.baseUrl}/v3/financial-growth/${symbol}?period=quarter&limit=40&apikey=${this.apiKey}`;
      const incomeGrowthUrl = `${this.baseUrl}/v3/income-statement-growth/${symbol}?period=quarter&limit=40&apikey=${this.apiKey}`;
      
      console.log(`📡 FMP URLs:`);
      console.log(`   Income: ${incomeUrl}`);
      console.log(`   Calendar: ${calendarUrl}`);
      console.log(`   Estimates: ${estimatesUrl}`);
      console.log(`   📊 GROWTH: ${growthUrl}`);
      console.log(`   📊 INCOME-GROWTH: ${incomeGrowthUrl}`);

      // Fetch income statement, earnings calendar, earnings estimates, financial growth, and income statement growth
      const [incomeResponse, earningsCalendarResponse, earningsEstimatesResponse, financialGrowthResponse, incomeGrowthResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/v3/income-statement/${symbol}`, {
          params: {
            period: 'quarter',
            limit: 40,
            apikey: this.apiKey
          },
          timeout: 30000
        }),
        axios.get(`${this.baseUrl}/v3/historical/earning_calendar/${symbol}`, {
          params: {
            apikey: this.apiKey
          },
          timeout: 30000
        }),
        axios.get(`${this.baseUrl}/v3/analyst-estimates/${symbol}`, {
          params: {
            period: 'quarter',
            limit: 40,
            apikey: this.apiKey
          },
          timeout: 30000
        }),
        axios.get(`${this.baseUrl}/v3/financial-growth/${symbol}`, {
          params: {
            period: 'quarter',
            limit: 40,
            apikey: this.apiKey
          },
          timeout: 30000
        }),
        axios.get(`${this.baseUrl}/v3/income-statement-growth/${symbol}`, {
          params: {
            period: 'quarter',
            limit: 40,
            apikey: this.apiKey
          },
          timeout: 30000
        })
      ]);

      const incomeStatements = incomeResponse.data || [];
      const earningsCalendar = earningsCalendarResponse.data || [];
      const estimates = earningsEstimatesResponse.data || [];
      const financialGrowth = financialGrowthResponse.data || [];
      const incomeGrowth = incomeGrowthResponse.data || [];

      console.log(`✅ Got ${incomeStatements.length} income, ${earningsCalendar.length} calendar, ${estimates.length} estimates, ${financialGrowth.length} fin-growth, ${incomeGrowth.length} inc-growth`);
      
      // Log sample data from both growth endpoints to compare
      if (financialGrowth.length > 0) {
        console.log(`📊 SAMPLE financial-growth:`, {
          date: financialGrowth[0].date,
          revenueGrowth: financialGrowth[0].revenueGrowth,
          calendarYear: financialGrowth[0].calendarYear
        });
      }
      
      if (incomeGrowth.length > 0) {
        console.log(`📊 SAMPLE income-growth:`, {
          date: incomeGrowth[0].date,
          growthRevenue: incomeGrowth[0].growthRevenue,
          calendarYear: incomeGrowth[0].calendarYear
        });
      }
      
      // Sample first earnings calendar record
      if (earningsCalendar.length > 0) {
        const sample = earningsCalendar[0];
        console.log(`   Sample calendar: ${sample.date} EPS ${sample.eps} vs ${sample.epsEstimated}, Revenue ${sample.revenue} vs ${sample.revenueEstimated}`);
      }

      // Combine data by fiscal date
      const fundamentalsMap = new Map();

      // Process income statement data
      incomeStatements.forEach(statement => {
        if (!statement.date) return;

        fundamentalsMap.set(statement.date, {
          fiscal_date_ending: statement.date,
          reported_date: statement.fillingDate || null,
          revenue: this.parseNumber(statement.revenue),
          gross_profit: this.parseNumber(statement.grossProfit),
          operating_income: this.parseNumber(statement.operatingIncome),
          net_income: this.parseNumber(statement.netIncome),
          eps: this.parseNumber(statement.eps),
          shares_outstanding: this.parseNumber(statement.weightedAverageShsOut)
        });
      });

      // Add earnings calendar data (actual earnings with dates)
      earningsCalendar.forEach(earning => {
        if (!earning.date) return;

        const existing = fundamentalsMap.get(earning.date) || {
          fiscal_date_ending: earning.date,
          reported_date: earning.date
        };

        existing.eps = this.parseNumber(earning.eps);
        existing.estimated_eps = this.parseNumber(earning.epsEstimated);
        existing.revenue = this.parseNumber(earning.revenue);
        existing.estimated_revenue = this.parseNumber(earning.revenueEstimated);

        // Calculate both EPS and revenue surprises
        if (existing.eps !== null && existing.estimated_eps !== null && existing.estimated_eps !== 0) {
          existing.eps_surprise_amount = existing.eps - existing.estimated_eps;
          existing.eps_surprise_percent = ((existing.eps - existing.estimated_eps) / Math.abs(existing.estimated_eps)) * 100;
        }

        if (existing.revenue !== null && existing.estimated_revenue !== null && existing.estimated_revenue !== 0) {
          existing.revenue_surprise_amount = existing.revenue - existing.estimated_revenue;
          existing.revenue_surprise_percent = ((existing.revenue - existing.estimated_revenue) / Math.abs(existing.estimated_revenue)) * 100;
        }

        fundamentalsMap.set(earning.date, existing);
      });

      // Add estimates data for quarters that might not have actual results yet
      estimates.forEach(estimate => {
        if (!estimate.date) return;

        const existing = fundamentalsMap.get(estimate.date) || {
          fiscal_date_ending: estimate.date,
          reported_date: null
        };

        if (!existing.estimated_eps) {
          existing.estimated_eps = this.parseNumber(estimate.estimatedEpsAvg);
        }
        if (!existing.estimated_revenue) {
          existing.estimated_revenue = this.parseNumber(estimate.estimatedRevenueAvg);
        }

        fundamentalsMap.set(estimate.date, existing);
      });

      // Skip FMP growth data (it's sequential, not YoY)
      console.log(`📊 Skipping FMP growth data (sequential, not YoY)`);

      // Convert to array and filter last 5 years
      const fundamentalsData = Array.from(fundamentalsMap.values());
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const filteredData = fundamentalsData.filter(data => {
        const fiscalDate = new Date(data.fiscal_date_ending);
        return fiscalDate >= fiveYearsAgo;
      });

      // Sort by fiscal date
      filteredData.sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));

      console.log(`✅ Processed ${filteredData.length} fundamental records`);
      return filteredData;
    } catch (error) {
      console.error('Error fetching quarterly fundamentals from FMP:', error.message);
      throw error;
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      console.log(`📡 FMP API: Corporate actions for ${symbol}`);

      const response = await axios.get(`${this.baseUrl}/v3/historical-price-full/stock_split/${symbol}`, {
        params: {
          apikey: this.apiKey
        },
        timeout: 30000
      });

      const splits = response.data.historical || [];
      
      const corporateActions = splits.map(split => ({
        action_date: split.date,
        action_type: 'SPLIT',
        split_ratio: `${split.numerator}:${split.denominator}`,
        adjustment_factor: split.denominator / split.numerator,
        description: `Stock split ${split.numerator}:${split.denominator}`
      }));

      console.log(`✅ Found ${corporateActions.length} corporate actions`);
      if (corporateActions.length > 0) {
        console.log(`   Sample: ${corporateActions[0].action_date} ${corporateActions[0].split_ratio} split`);
      }
      return corporateActions;
    } catch (error) {
      console.error('Error fetching corporate actions from FMP:', error.message);
      return []; // Corporate actions are optional
    }
  }

  async fetchEarningsCalendar(symbol, startDate, endDate) {
    try {
      console.log(`📅 FMP API: Earnings calendar for ${symbol} from ${startDate} to ${endDate}`);
      
      const response = await axios.get(`${this.baseUrl}/v3/earning_calendar`, {
        params: {
          from: startDate,
          to: endDate,
          apikey: this.apiKey
        },
        timeout: 30000
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.log(`❌ No earnings calendar data found for ${symbol}`);
        return [];
      }

      // Filter for specific symbol and return relevant data
      const symbolData = response.data.filter(entry => 
        entry.symbol === symbol && entry.date
      );

      console.log(`✅ Found ${symbolData.length} earnings calendar entries for ${symbol}`);
      if (symbolData.length > 0) {
        console.log(`   Sample entry:`, JSON.stringify(symbolData[0], null, 2));
      }

      return symbolData.map(entry => ({
        symbol: entry.symbol,
        announcement_date: entry.date,
        fiscal_date_ending: entry.fiscalDateEnding,
        estimated_eps: this.parseNumber(entry.epsEstimated),
        actual_eps: this.parseNumber(entry.eps),
        estimated_revenue: this.parseNumber(entry.revenueEstimated),
        actual_revenue: this.parseNumber(entry.revenue),
        time: entry.time
      }));
    } catch (error) {
      console.error('Error fetching earnings calendar from FMP:', error.message);
      return [];
    }
  }

  parseNumber(value) {
    if (!value || value === 'None' || value === 'null' || value === 'N/A') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

module.exports = FMPProvider;