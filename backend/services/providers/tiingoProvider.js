const axios = require('axios');

class TiingoProvider {
  constructor() {
    this.apiKey = process.env.TIINGO_API_KEY;
    this.baseUrl = 'https://api.tiingo.com/tiingo';
    
    if (!this.apiKey) {
      console.warn('Warning: TIINGO_API_KEY not set. Tiingo API calls will fail.');
    }
  }

  async fetchDailyPrices(symbol) {
    try {
      console.log(`📡 Tiingo API: Daily prices for ${symbol}`);
      
      // Get 5 years of historical data
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 5);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const response = await axios.get(`${this.baseUrl}/daily/${symbol}/prices`, {
        params: {
          token: this.apiKey,
          startDate: startDateStr,
          endDate: endDate,
          format: 'json'
        },
        timeout: 30000
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No historical price data found in Tiingo response');
      }

      // Convert Tiingo format to our format
      const pricesData = response.data.map(item => ({
        date: item.date.split('T')[0], // Extract date part only
        open: item.open || null,
        high: item.high || null,
        low: item.low || null,
        close: item.close || null,
        adjusted_close: item.adjClose || null,
        volume: item.volume || null
      }));

      // Sort by date ascending
      pricesData.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log(`✅ Got ${pricesData.length} prices. Sample: ${pricesData[0]?.date} = $${pricesData[0]?.close}`);
      return pricesData;
    } catch (error) {
      console.error('Error fetching daily prices from Tiingo:', error.message);
      throw error;
    }
  }

  async fetchQuarterlyFundamentals(symbol) {
    try {
      console.log(`📡 Tiingo API: Fundamentals for ${symbol}`);

      // Tiingo fundamentals endpoint
      const response = await axios.get(`${this.baseUrl}/fundamentals/${symbol}/statements`, {
        params: {
          token: this.apiKey,
          format: 'json'
        },
        timeout: 30000
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No fundamental data found in Tiingo response');
      }

      const fundamentalsData = [];
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      // Process each statement group
      response.data.forEach(statementGroup => {
        if (!statementGroup.statementData || !statementGroup.statementData.incomeStatement) return;
        if (!statementGroup.year || !statementGroup.quarter) return;

        // Create fiscal date from year and quarter
        const fiscalDate = this.getFiscalDateFromQuarter(statementGroup.year, statementGroup.quarter);
        
        if (new Date(fiscalDate) < fiveYearsAgo) return;

        // Extract values from incomeStatement array
        const incomeStatement = statementGroup.statementData.incomeStatement;
        const getValue = (dataCode) => {
          const item = incomeStatement.find(item => item.dataCode === dataCode);
          return item ? item.value : null;
        };

        // Map Tiingo data to our format
        const fundamental = {
          fiscal_date_ending: fiscalDate,
          reported_date: statementGroup.date || null,
          revenue: this.parseNumber(getValue('revenue')),
          gross_profit: this.parseNumber(getValue('grossProfit')),
          operating_income: this.parseNumber(getValue('opinc')), // operating income
          net_income: this.parseNumber(getValue('netinc')),
          eps: this.parseNumber(getValue('eps')),
          shares_outstanding: this.parseNumber(getValue('shareswa')) // weighted average shares
        };

        fundamentalsData.push(fundamental);
      });

      // Sort by fiscal date
      fundamentalsData.sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));

      console.log(`✅ Processed ${fundamentalsData.length} fundamental records`);
      return fundamentalsData;
    } catch (error) {
      console.error('Error fetching quarterly fundamentals from Tiingo:', error.message);
      throw error;
    }
  }

  async fetchCorporateActions(symbol) {
    try {
      console.log(`📡 Tiingo API: Corporate actions for ${symbol}`);

      // Tiingo doesn't have a direct corporate actions endpoint
      // We'll return empty array for now and implement if needed
      console.log(`⚠️ Corporate actions not implemented for Tiingo provider yet`);
      return [];
    } catch (error) {
      console.error('Error fetching corporate actions from Tiingo:', error.message);
      return []; // Corporate actions are optional
    }
  }

  getFiscalDateFromQuarter(year, quarter) {
    // Convert quarter number to end date
    const quarterEndDates = {
      1: `${year}-03-31`,
      2: `${year}-06-30`,
      3: `${year}-09-30`,
      4: `${year}-12-31`
    };
    
    return quarterEndDates[quarter] || `${year}-12-31`;
  }

  parseNumber(value) {
    if (!value || value === 'None' || value === 'null' || value === 'N/A') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

module.exports = TiingoProvider;