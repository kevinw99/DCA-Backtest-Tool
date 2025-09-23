const axios = require('axios');

class TwelveDataProvider {
  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY;
    this.baseUrl = 'https://api.twelvedata.com';
    
    if (!this.apiKey) {
      console.warn('Warning: TWELVE_DATA_API_KEY not set. Twelve Data API calls will fail.');
    }
  }

  async fetchDailyPrices(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/time_series`, {
        params: {
          symbol: symbol,
          interval: '1day',
          outputsize: 5000, // ~5 years of data
          apikey: this.apiKey
        },
        timeout: 30000
      });

      if (response.data.status === 'error') {
        throw new Error(`Twelve Data API Error: ${response.data.message}`);
      }

      const timeSeries = response.data.values;
      if (!timeSeries || timeSeries.length === 0) {
        throw new Error('No time series data found in API response');
      }

      // Convert to our format
      const pricesData = timeSeries.map(item => ({
        date: item.datetime,
        open: parseFloat(item.open) || null,
        high: parseFloat(item.high) || null,
        low: parseFloat(item.low) || null,
        close: parseFloat(item.close) || null,
        volume: parseInt(item.volume) || null
      }));

      // Sort by date ascending (Twelve Data returns newest first)
      pricesData.sort((a, b) => new Date(a.date) - new Date(b.date));
      return pricesData;
    } catch (error) {
      console.error('Error fetching daily prices from Twelve Data:', error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      // Fetch income statement and earnings data
      const [incomeResponse, earningsResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/income_statement`, {
          params: {
            symbol: symbol,
            period: 'quarterly',
            apikey: this.apiKey
          },
          timeout: 30000
        }),
        axios.get(`${this.baseUrl}/earnings`, {
          params: {
            symbol: symbol,
            period: 'quarterly',
            apikey: this.apiKey
          },
          timeout: 30000
        })
      ]);

      const incomeData = incomeResponse.data.income_statement || [];
      const earningsData = earningsResponse.data.earnings || [];

      // Combine data by fiscal period
      const fundamentalsMap = new Map();

      // Process income statement data
      incomeData.forEach(report => {
        if (!report.fiscal_date) return;

        fundamentalsMap.set(report.fiscal_date, {
          fiscal_date_ending: report.fiscal_date,
          reported_date: report.filing_date || null,
          revenue: this.parseNumber(report.total_revenue),
          gross_profit: this.parseNumber(report.gross_profit),
          operating_income: this.parseNumber(report.operating_income),
          net_income: this.parseNumber(report.net_income),
          shares_outstanding: this.parseNumber(report.weighted_average_shares_outstanding),
          eps: null
        });
      });

      // Add earnings data
      earningsData.forEach(earnings => {
        if (!earnings.fiscal_date) return;

        const existing = fundamentalsMap.get(earnings.fiscal_date) || {
          fiscal_date_ending: earnings.fiscal_date,
          reported_date: earnings.date || null
        };

        existing.eps = this.parseNumber(earnings.eps_actual);
        existing.estimated_eps = this.parseNumber(earnings.eps_estimate);
        
        // Calculate EPS surprise
        if (existing.eps !== null && existing.estimated_eps !== null && existing.estimated_eps !== 0) {
          existing.eps_surprise_amount = existing.eps - existing.estimated_eps;
          existing.eps_surprise_percent = ((existing.eps - existing.estimated_eps) / Math.abs(existing.estimated_eps)) * 100;
        }
        
        fundamentalsMap.set(earnings.fiscal_date, existing);
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
      console.error('Error fetching quarterly fundamentals from Twelve Data:', error.message);
      throw error;
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/splits`, {
        params: {
          symbol: symbol,
          apikey: this.apiKey
        },
        timeout: 30000
      });

      const splitsData = response.data.splits || [];
      
      const corporateActions = splitsData.map(split => ({
        action_date: split.date,
        action_type: 'SPLIT',
        split_ratio: `${split.to_factor}:${split.from_factor}`,
        adjustment_factor: split.from_factor / split.to_factor,
        description: `Stock split ${split.to_factor}:${split.from_factor}`
      }));

      return corporateActions;
    } catch (error) {
      console.error('Error fetching corporate actions from Twelve Data:', error.message);
      return []; // Corporate actions are optional
    }
  }

  parseNumber(value) {
    if (!value || value === 'None' || value === 'null' || value === 'N/A') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

module.exports = TwelveDataProvider;