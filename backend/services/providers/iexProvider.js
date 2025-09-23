const axios = require('axios');

class IEXProvider {
  constructor() {
    this.apiKey = process.env.IEX_API_KEY;
    this.baseUrl = 'https://cloud.iexapis.com/stable';
    
    if (!this.apiKey) {
      console.warn('Warning: IEX_API_KEY not set. IEX API calls will fail.');
    }
  }

  async fetchDailyPrices(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/stock/${symbol}/chart/5y`, {
        params: {
          token: this.apiKey,
          includeToday: true
        },
        timeout: 30000
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No price data found in IEX response');
      }

      // Convert IEX format to our format
      const pricesData = response.data.map(item => ({
        date: item.date,
        open: item.open || null,
        high: item.high || null,
        low: item.low || null,
        close: item.close || null,
        volume: item.volume || null
      }));

      return pricesData;
    } catch (error) {
      console.error('Error fetching daily prices from IEX:', error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      // Fetch income statement data
      const incomeResponse = await axios.get(`${this.baseUrl}/stock/${symbol}/income`, {
        params: {
          token: this.apiKey,
          period: 'quarter',
          last: 20
        },
        timeout: 30000
      });

      // Fetch earnings data with estimates
      const earningsResponse = await axios.get(`${this.baseUrl}/stock/${symbol}/earnings`, {
        params: {
          token: this.apiKey,
          last: 20
        },
        timeout: 30000
      });

      const incomeData = incomeResponse.data.income || [];
      const earningsData = earningsResponse.data.earnings || [];

      // Combine data by fiscal period
      const fundamentalsMap = new Map();

      // Process income statement data
      incomeData.forEach(report => {
        if (!report.fiscalDate) return;

        fundamentalsMap.set(report.fiscalDate, {
          fiscal_date_ending: report.fiscalDate,
          reported_date: report.reportDate || null,
          revenue: this.parseNumber(report.totalRevenue),
          gross_profit: this.parseNumber(report.grossProfit),
          operating_income: this.parseNumber(report.operatingIncome),
          net_income: this.parseNumber(report.netIncome),
          shares_outstanding: null,
          eps: null
        });
      });

      // Add earnings data with estimates
      earningsData.forEach(earnings => {
        if (!earnings.fiscalDate) return;

        const existing = fundamentalsMap.get(earnings.fiscalDate) || {
          fiscal_date_ending: earnings.fiscalDate,
          reported_date: earnings.reportDate || null
        };

        existing.eps = this.parseNumber(earnings.actualEPS);
        existing.estimated_eps = this.parseNumber(earnings.consensusEPS);
        
        // Calculate EPS surprise
        if (existing.eps !== null && existing.estimated_eps !== null && existing.estimated_eps !== 0) {
          existing.eps_surprise_amount = existing.eps - existing.estimated_eps;
          existing.eps_surprise_percent = ((existing.eps - existing.estimated_eps) / Math.abs(existing.estimated_eps)) * 100;
        }
        
        fundamentalsMap.set(earnings.fiscalDate, existing);
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
      console.error('Error fetching quarterly fundamentals from IEX:', error.message);
      throw error;
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/stock/${symbol}/splits/5y`, {
        params: {
          token: this.apiKey
        },
        timeout: 30000
      });

      const splitsData = response.data || [];
      
      const corporateActions = splitsData.map(split => ({
        action_date: split.exDate,
        action_type: 'SPLIT',
        split_ratio: `${split.toFactor}:${split.fromFactor}`,
        adjustment_factor: split.fromFactor / split.toFactor,
        description: `Stock split ${split.toFactor}:${split.fromFactor}`
      }));

      return corporateActions;
    } catch (error) {
      console.error('Error fetching corporate actions from IEX:', error.message);
      return []; // Corporate actions are optional
    }
  }

  parseNumber(value) {
    if (!value || value === 'None' || value === 'null') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

module.exports = IEXProvider;