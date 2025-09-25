const database = require('../database');
const AlphaVantageProvider = require('./providers/alphaVantageProvider');
const TwelveDataProvider = require('./providers/twelveDataProvider');
const FMPProvider = require('./providers/fmpProvider');
const TiingoProvider = require('./providers/tiingoProvider');
const YFinanceProvider = require('./providers/yfinanceProvider');

class StockDataService {
  constructor() {
    const providerType = process.env.DATA_PROVIDER || 'alphavantage';
    
    switch (providerType.toLowerCase()) {
      case 'yfinance':
        this.provider = new YFinanceProvider();
        console.log('Using Yahoo Finance (yfinance) provider - FREE unlimited access!');
        break;
      case 'tiingo':
        this.provider = new TiingoProvider();
        console.log('Using Tiingo provider - comprehensive financial data!');
        break;
      case 'fmp':
        this.provider = new FMPProvider();
        console.log('Using Financial Modeling Prep (FMP) provider - excellent earnings data!');
        break;
      case 'twelvedata':
        this.provider = new TwelveDataProvider();
        console.log('Using Twelve Data provider (800 requests/day)');
        break;
      case 'alphavantage':
      default:
        this.provider = new AlphaVantageProvider();
        console.log('Using Alpha Vantage data provider (25 requests/day)');
        break;
    }
  }

  async updateStockData(stockId, symbol, options = {}) {
    const { updatePrices = true, updateFundamentals = true, updateCorporateActions = true, fromDate = null, forceRefresh = false } = options;

    try {
      // Clear data if force refresh is enabled (development flag)
      if (forceRefresh) {
        console.log(`🔄 Force refresh enabled - clearing existing data for ${symbol}`);
        await this.clearStockData(stockId, { clearPrices: updatePrices, clearFundamentals: updateFundamentals, clearCorporateActions: updateCorporateActions });
      }

      if (updateCorporateActions) {
        console.log(`Fetching corporate actions for ${symbol}`);
        await this.fetchAndStoreCorporateActions(stockId, symbol);
      }

      if (updatePrices) {
        console.log(`Fetching daily prices for ${symbol}`);
        await this.fetchAndStoreDailyPrices(stockId, symbol, fromDate);
      }

      if (updateFundamentals) {
        console.log(`Fetching quarterly fundamentals for ${symbol}`);
        await this.fetchAndStoreQuarterlyData(stockId, symbol);
      }

      console.log(`✅ Successfully updated data for ${symbol}`);
    } catch (error) {
      console.error(`❌ Error updating stock data for ${symbol}:`, error.message);
      console.error(`   Stack trace:`, error.stack);
      throw error;
    }
  }

  async fetchAndStoreDailyPrices(stockId, symbol, fromDate = null) {
    try {
      const pricesData = await this.provider.fetchDailyPrices(symbol);

      // Filter by fromDate if provided for incremental updates
      let filteredData = pricesData;
      if (fromDate) {
        const cutoffDate = new Date(fromDate);
        filteredData = pricesData.filter(price => new Date(price.date) > cutoffDate);
      }

      if (filteredData.length > 0) {
        console.log(`Storing ${filteredData.length} daily price records for ${symbol} (${fromDate ? 'incremental update' : 'full load'})`);
        await database.insertDailyPrices(stockId, filteredData);
      } else {
        console.log(`No new price data to store for ${symbol}`);
      }

      return filteredData.length;
    } catch (error) {
      console.error('Error fetching daily prices:', error.message);
      throw error;
    }
  }

  async fetchAndStoreQuarterlyData(stockId, symbol) {
    try {
      const fundamentalsData = await this.provider.fetchQuarterlyFundamentals(symbol);

      console.log(`Storing ${fundamentalsData.length} quarterly fundamental records for ${symbol}`);
      await database.insertQuarterlyFundamentals(stockId, fundamentalsData);

      return fundamentalsData.length;
    } catch (error) {
      console.error('Error fetching quarterly data:', error.message);
      throw error;
    }
  }

  async fetchAndStoreCorporateActions(stockId, symbol) {
    try {
      const rawCorporateActions = await this.provider.fetchCorporateActions(symbol);

      // Transform YFinance data format to database format
      const corporateActions = rawCorporateActions.map(action => ({
        action_date: action.date,
        action_type: action.action === 'split' ? 'SPLIT' : action.action === 'dividend' ? 'DIVIDEND' : action.action_type,
        split_ratio: action.action === 'split' ? `${action.ratio}:1` : action.split_ratio,
        adjustment_factor: action.action === 'split' ? (1 / action.ratio) : action.adjustment_factor,
        description: action.description || `${action.action} event`
      })).filter(action => action.action_date); // Filter out actions with null dates

      // Also detect splits from price data (gap analysis)
      const detectedSplits = await this.detectSplitsFromPriceData(stockId, symbol);
      corporateActions.push(...detectedSplits);

      // Remove duplicates and sort by date
      const uniqueActions = corporateActions.filter((action, index, self) => 
        index === self.findIndex(a => a.action_date === action.action_date && a.action_type === action.action_type)
      ).sort((a, b) => new Date(a.action_date) - new Date(b.action_date));

      if (uniqueActions.length > 0) {
        console.log(`Storing ${uniqueActions.length} corporate actions for ${symbol}`);
        await database.insertCorporateActions(stockId, uniqueActions);
      } else {
        console.log(`No corporate actions found for ${symbol}`);
      }

      return uniqueActions.length;
    } catch (error) {
      console.error('Error fetching corporate actions:', error.message);
      // Don't throw - corporate actions are optional
      return 0;
    }
  }

  async detectSplitsFromPriceData(stockId, symbol) {
    try {
      console.log(`🔍 Analyzing price data for split detection in ${symbol}`);
      
      // Get daily prices to analyze for potential splits
      const dailyPrices = await database.getDailyPrices(stockId);
      if (dailyPrices.length < 2) {
        console.log(`   Not enough price data (${dailyPrices.length} records)`);
        return [];
      }

      const detectedSplits = [];
      
      for (let i = 1; i < dailyPrices.length; i++) {
        const prevPrice = dailyPrices[i - 1];
        const currPrice = dailyPrices[i];
        
        // Skip if missing essential data
        if (!prevPrice.close || !currPrice.close) continue;
        
        // Calculate price change from previous close to current close
        // This handles overnight gaps and weekend/holiday effects better
        const priceChange = ((currPrice.close - prevPrice.close) / prevPrice.close) * 100;
        
        // Check for significant price drop (potential split) OR price increase (reverse split)
        if (Math.abs(priceChange) > 30) {
          console.log(`   📉 Large price change detected: ${prevPrice.date} $${prevPrice.close} -> ${currPrice.date} $${currPrice.close} (${priceChange.toFixed(1)}%)`);
          
          let potentialRatio;
          let isReverseSplit = false;
          
          if (priceChange < -30) {
            // Regular split: price dropped significantly
            potentialRatio = prevPrice.close / currPrice.close;
          } else {
            // Reverse split: price increased significantly  
            potentialRatio = currPrice.close / prevPrice.close;
            isReverseSplit = true;
          }
          
          console.log(`   🔍 Potential ratio: ${potentialRatio.toFixed(2)}:1 ${isReverseSplit ? '(reverse)' : ''}`);
          
          // Check if it's close to common split ratios
          const commonRatios = [2, 3, 4, 5, 7, 10, 20];
          for (const ratio of commonRatios) {
            if (Math.abs(potentialRatio - ratio) < 0.3) {
              console.log(`   ✅ Matches common ratio ${ratio}:1`);
              
              // For splits, verify the pattern continues for a few days
              const isConsistent = this.verifySplitConsistency(dailyPrices, i, potentialRatio, isReverseSplit);
              
              if (isConsistent) {
                const splitRatio = isReverseSplit ? `1:${ratio}` : `${ratio}:1`;
                const adjustmentFactor = isReverseSplit ? ratio : (1 / ratio);
                
                detectedSplits.push({
                  action_date: currPrice.date,
                  action_type: 'SPLIT',
                  split_ratio: splitRatio,
                  adjustment_factor: adjustmentFactor,
                  description: `Detected ${isReverseSplit ? 'reverse ' : ''}split ${splitRatio} from price analysis`
                });
                
                console.log(`   🎯 Split detected: ${splitRatio} on ${currPrice.date}`);
                break;
              } else {
                console.log(`   ❌ Pattern not consistent over following days`);
              }
            }
          }
        }
      }

      console.log(`🔍 Detected ${detectedSplits.length} splits for ${symbol}`);
      return detectedSplits;
    } catch (error) {
      console.error('Error detecting splits from price data:', error.message);
      return [];
    }
  }

  verifySplitConsistency(dailyPrices, splitIndex, expectedRatio, isReverseSplit) {
    // Check that the price level is maintained for at least 2-3 days after the split
    if (splitIndex + 3 >= dailyPrices.length) return true; // Not enough future data, assume consistent
    
    const splitPrice = dailyPrices[splitIndex];
    let consistentDays = 0;
    
    for (let i = 1; i <= 3; i++) {
      if (splitIndex + i >= dailyPrices.length) break;
      
      const futurePrice = dailyPrices[splitIndex + i];
      if (!futurePrice.close) continue;
      
      // Check if the price is in the expected range (post-split level)
      const priceRatio = isReverseSplit ? 
        (futurePrice.close / splitPrice.close) : 
        (splitPrice.close / futurePrice.close);
      
      // Allow some volatility but price should stay in reasonable range
      if (priceRatio >= 0.7 && priceRatio <= 1.5) {
        consistentDays++;
      }
    }
    
    // Require at least 1 consistent day to confirm
    return consistentDays >= 1;
  }

  async clearStockData(stockId, options = {}) {
    const { clearPrices = false, clearFundamentals = false, clearCorporateActions = false } = options;
    
    try {
      if (clearPrices) {
        console.log(`  🗑️  Clearing daily prices for stock ID ${stockId}`);
        await database.clearDailyPrices(stockId);
      }
      
      if (clearFundamentals) {
        console.log(`  🗑️  Clearing quarterly fundamentals for stock ID ${stockId}`);
        await database.clearQuarterlyFundamentals(stockId);
      }
      
      if (clearCorporateActions) {
        console.log(`  🗑️  Clearing corporate actions for stock ID ${stockId}`);
        await database.clearCorporateActions(stockId);
      }
    } catch (error) {
      console.error('Error clearing stock data:', error.message);
      throw error;
    }
  }

  parseNumber(value) {
    if (!value || value === 'None' || value === 'null') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  convertCumulativeToQuarterly(data, field) {
    if (!data || data.length === 0) return [];
    
    // Sort by fiscal date to ensure proper order
    const sortedData = [...data].sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));
    
    console.log(`📊 Converting cumulative ${field} to quarterly amounts (${sortedData.length} records)`);
    
    const quarterlyData = [];
    const fiscalYears = {};
    
    // Group by fiscal year
    sortedData.forEach(record => {
      const fiscalDate = new Date(record.fiscal_date_ending);
      const fiscalYear = fiscalDate.getFullYear();
      
      if (!fiscalYears[fiscalYear]) {
        fiscalYears[fiscalYear] = [];
      }
      
      fiscalYears[fiscalYear].push(record);
    });
    
    // Process each fiscal year
    Object.keys(fiscalYears).forEach(year => {
      const yearData = fiscalYears[year].sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));
      
      console.log(`📊 Processing fiscal year ${year} with ${yearData.length} quarters`);
      
      yearData.forEach((record, index) => {
        const cumulativeValue = record[field];
        let quarterlyValue;
        
        if (index === 0) {
          // First quarter of fiscal year = cumulative value (Q1)
          quarterlyValue = cumulativeValue;
        } else {
          // Subtract previous quarter's cumulative to get this quarter's amount
          const previousCumulative = yearData[index - 1][field];
          quarterlyValue = cumulativeValue - previousCumulative;
        }
        
        console.log(`   ${record.fiscal_date_ending}: Cumulative $${(cumulativeValue/1000000).toFixed(1)}M -> Quarterly $${(quarterlyValue/1000000).toFixed(1)}M`);
        
        quarterlyData.push({
          ...record,
          quarterly_value: quarterlyValue
        });
      });
    });
    
    // Sort final result by fiscal date
    return quarterlyData.sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));
  }

  calculateMetrics(dailyPrices, quarterlyFundamentals, corporateActions = [], symbol = null) {
    const metrics = {};

    // Price metrics - use Alpha Vantage's adjusted_close for split-adjusted prices
    if (dailyPrices.length > 0) {
      // Check if we have Alpha Vantage adjusted prices
      const hasAdjustedPrices = dailyPrices[0].adjusted_close !== undefined && dailyPrices[0].adjusted_close !== null;
      
      if (hasAdjustedPrices) {
        console.log(`📊 Using Alpha Vantage split-adjusted prices for stock`);
        
        // Use Alpha Vantage's split-adjusted prices as the primary price metric
        metrics.price = dailyPrices.map(price => ({
          date: price.date,
          value: price.adjusted_close,
          adjusted: true
        }));
        
        // Also provide raw (pre-split) prices for comparison
        metrics.raw_price = dailyPrices.map(price => ({
          date: price.date,
          value: price.close,
          raw: true
        }));
        
        // Add split events based on split_coefficient
        const splitEvents = dailyPrices
          .filter(price => price.split_coefficient && price.split_coefficient !== 1)
          .map(price => ({
            date: price.date,
            coefficient: price.split_coefficient,
            description: `Stock split (coefficient: ${price.split_coefficient})`
          }));
          
        if (splitEvents.length > 0) {
          metrics.splits = splitEvents;
          console.log(`📊 Found ${splitEvents.length} split events in price data`);
        }
      } else {
        console.log(`📊 Using raw prices (no adjusted_close available)`);
        // Use raw prices
        metrics.price = dailyPrices.map(price => ({
          date: price.date,
          value: price.close,
          raw: true
        }));
      }

      metrics.volume = dailyPrices.map(price => ({
        date: price.date,
        value: price.volume
      }));
    }

    // Split events for chart markers
    if (corporateActions.length > 0) {
      metrics.splits = corporateActions
        .filter(action => action.action_type === 'SPLIT')
        .map(split => ({
          date: split.action_date,
          ratio: split.split_ratio,
          description: split.description
        }));
    }

    // Quarterly metrics
    if (quarterlyFundamentals.length > 0) {
      // Filter to records with actual fundamental data (revenue, eps, etc.)
      // Don't filter by fiscal date patterns since companies have different fiscal years
      const quarterlyReports = quarterlyFundamentals.filter(f => {
        // For Alpha Vantage, reported_date might be null, so don't require it
        const hasActualData = f.revenue !== null || f.eps !== null || f.gross_profit !== null;
        return hasActualData;
      });

      // Deduplicate by fiscal_date_ending and sort by fiscal period for YoY calculations
      const uniqueFundamentals = quarterlyReports.reduce((acc, current) => {
        const existing = acc.find(f => f.fiscal_date_ending === current.fiscal_date_ending);
        if (!existing) {
          acc.push(current);
        } else {
          // If duplicate fiscal period, prefer the one with more complete data
          if (current.revenue && !existing.revenue) {
            acc[acc.indexOf(existing)] = current;
          }
        }
        return acc;
      }, []).sort((a, b) => new Date(a.fiscal_date_ending) - new Date(b.fiscal_date_ending));

      console.log(`📊 Filtered quarterly reports: ${quarterlyFundamentals.length} -> ${uniqueFundamentals.length} records`);
      if (uniqueFundamentals.length > 0) {
        console.log(`   Sample: ${uniqueFundamentals[0].fiscal_date_ending} reported on ${uniqueFundamentals[0].reported_date}`);
      }

      // Check if any records have missing reportedDate
      const recordsWithoutReportedDate = uniqueFundamentals.filter(f => !f.reported_date);
      if (recordsWithoutReportedDate.length > 0) {
        console.warn(`⚠️  ${recordsWithoutReportedDate.length} quarterly records missing actual announcement dates`);
        console.warn(`   These records will be excluded from quarterly charts`);
        console.warn(`   Missing dates for fiscal periods: ${recordsWithoutReportedDate.map(f => f.fiscal_date_ending).join(', ')}`);
      }

      // Revenue (only include records with actual announcement dates)
      const revenueData = uniqueFundamentals.filter(f => f.revenue !== null && f.reported_date);
      if (revenueData.length === 0 && uniqueFundamentals.filter(f => f.revenue !== null).length > 0) {
        console.error(`❌ No revenue data with announcement dates available for ${symbol || 'stock'}`);
      }
      metrics.revenue = revenueData.map(f => ({
        date: f.reported_date,
        value: f.revenue / 1000000, // Convert to millions
        fiscal_period: f.fiscal_date_ending
      }));

      // Net Income (only include records with actual announcement dates)
      const netIncomeData = uniqueFundamentals.filter(f => f.net_income !== null && f.reported_date);
      if (netIncomeData.length === 0 && uniqueFundamentals.filter(f => f.net_income !== null).length > 0) {
        console.error(`❌ No Net Income data with announcement dates available`);
      }
      
      // Use Net Income values directly (Alpha Vantage provides quarterly amounts, not cumulative)
      metrics.net_income = netIncomeData.map(f => ({
        date: f.reported_date,
        value: f.net_income / 1000000, // Convert to millions
        fiscal_period: f.fiscal_date_ending
      }));

      // Calculate margins (only include records with actual announcement dates)
      metrics.gross_margin = uniqueFundamentals
        .filter(f => f.revenue && f.gross_profit && f.reported_date)
        .map(f => ({
          date: f.reported_date,
          value: (f.gross_profit / f.revenue) * 100,
          fiscal_period: f.fiscal_date_ending
        }));

      metrics.operating_margin = uniqueFundamentals
        .filter(f => f.revenue && f.operating_income && f.reported_date)
        .map(f => ({
          date: f.reported_date,
          value: (f.operating_income / f.revenue) * 100,
          fiscal_period: f.fiscal_date_ending
        }));

      metrics.net_margin = uniqueFundamentals
        .filter(f => f.revenue && f.net_income && f.reported_date)
        .map(f => ({
          date: f.reported_date,
          value: (f.net_income / f.revenue) * 100,
          fiscal_period: f.fiscal_date_ending
        }));

      // Earnings surprises - get from original data (not filtered to quarterly periods)
      // because surprise data might be in the earnings report dates, not fiscal periods
      const earningsSurpriseData = quarterlyFundamentals
        .filter(f => f.eps_surprise_percent !== null || f.revenue_surprise_percent !== null)
        .reduce((acc, current) => {
          // Deduplicate by fiscal period if both exist
          const existing = acc.find(f => f.fiscal_date_ending === current.fiscal_date_ending);
          if (!existing) {
            acc.push(current);
          }
          return acc;
        }, []);
      
      console.log(`📊 Earnings surprises data: ${earningsSurpriseData.length} records`);
      if (earningsSurpriseData.length > 0) {
        const sample = earningsSurpriseData[0];
        console.log(`   Sample: ${sample.fiscal_date_ending} -> EPS: ${sample.eps_surprise_percent}%, Revenue: ${sample.revenue_surprise_percent}%`);
      }

      metrics.earnings_surprises = earningsSurpriseData
        .filter(f => f.reported_date) // Only include records with actual announcement dates
        .map(f => ({
          date: f.reported_date,
          eps_surprise: f.eps_surprise_percent || 0,
          revenue_surprise: f.revenue_surprise_percent || 0,
          fiscal_period: f.fiscal_date_ending,
          eps_actual: f.eps,
          eps_estimate: f.estimated_eps,
          revenue_actual: f.revenue,
          revenue_estimate: f.estimated_revenue
        }));

      // YoY Growth - calculate manually since FMP provides sequential growth, not YoY
      metrics.yoy_revenue_growth = this.calculateQuarterlyYoYGrowth(uniqueFundamentals, 'revenue');
      
      // For Net Income YoY growth, use the data directly (already quarterly amounts)
      metrics.yoy_net_income_growth = this.calculateQuarterlyYoYGrowth(uniqueFundamentals, 'net_income');

      // P/E Ratio (requires matching price data with quarterly data)
      metrics.pe_ratio = this.calculatePERatio(dailyPrices, uniqueFundamentals);
    }

    return metrics;
  }

  calculateQuarterlyYoYGrowth(fundamentalsData, metricField) {
    if (!fundamentalsData || fundamentalsData.length < 5) {
      console.log(`📊 YoY Growth (${metricField}): Not enough data`);
      return [];
    }

    console.log(`📊 Calculating YoY Growth for ${metricField} (${fundamentalsData.length} quarters)`);
    if (fundamentalsData.length > 0) {
      console.log(`   Sample: ${fundamentalsData[0].fiscal_date_ending} = ${fundamentalsData[0][metricField]}`);
    }

    const growthData = [];
    
    // Group by fiscal quarter (approximate month) to handle varying end dates
    const quarterGroups = {};
    
    fundamentalsData.forEach(f => {
      if (!f[metricField] || f[metricField] === null) return;
      
      const fiscalDate = new Date(f.fiscal_date_ending);
      // Group by approximate quarter: Q1=Jan-Mar(0-2), Q2=Apr-Jun(3-5), Q3=Jul-Sep(6-8), Q4=Oct-Dec(9-11)
      const quarter = Math.floor(fiscalDate.getMonth() / 3);
      const quarterKey = `Q${quarter + 1}`;
      
      if (!quarterGroups[quarterKey]) {
        quarterGroups[quarterKey] = [];
      }
      
      quarterGroups[quarterKey].push({
        fiscal_date: f.fiscal_date_ending,
        reported_date: f.reported_date,
        value: f[metricField],
        year: fiscalDate.getFullYear()
      });
    });

    console.log(`📊 Quarter groups: ${Object.keys(quarterGroups).map(key => `${key}:${quarterGroups[key].length}`).join(', ')}`);

    // Calculate YoY growth for each quarter group
    Object.keys(quarterGroups).forEach(quarterKey => {
      const quarters = quarterGroups[quarterKey].sort((a, b) => a.year - b.year);
      
      // Only compare quarters that are at least 1 year apart
      for (let i = 1; i < quarters.length; i++) {
        const current = quarters[i];
        const yearAgo = quarters[i - 1];
        
        // Ensure we're comparing different years (YoY)
        if (current.year > yearAgo.year && current.value && yearAgo.value && yearAgo.value !== 0) {
          const growth = ((current.value - yearAgo.value) / Math.abs(yearAgo.value)) * 100;
          
          // Only include if we have actual reported date
          if (current.reported_date) {
            growthData.push({
              date: current.reported_date,
              value: growth,
              fiscal_period: current.fiscal_date,
              comparison: `vs ${yearAgo.fiscal_date}`
            });
          }
        }
      }
    });

    // Sort by reported date
    growthData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`📊 YoY Growth (${metricField}): Generated ${growthData.length} data points`);
    if (growthData.length > 0) {
      console.log(`   Sample: ${growthData[0].date} = ${growthData[0].value.toFixed(1)}%`);
    }
    return growthData;
  }

  calculateYoYGrowth(quarterlyData) {
    if (!quarterlyData || quarterlyData.length < 5) {
      console.log(`📊 YoY Growth: Not enough data (need 5+ quarters, have ${quarterlyData?.length || 0})`);
      return [];
    }

    console.log(`📊 YoY Growth calculation for ${quarterlyData.length} quarters:`);
    quarterlyData.forEach((q, i) => console.log(`   [${i}] ${q.date}: $${q.value}M (fiscal: ${q.fiscal_period})`));

    const growthData = [];
    
    for (let i = 4; i < quarterlyData.length; i++) {
      const current = quarterlyData[i];
      const yearAgo = quarterlyData[i - 4];
      
      if (current.value && yearAgo.value && yearAgo.value !== 0) {
        const growth = ((current.value - yearAgo.value) / Math.abs(yearAgo.value)) * 100;
        console.log(`   YoY: ${current.date} ($${current.value}M) vs ${yearAgo.date} ($${yearAgo.value}M) = ${growth.toFixed(1)}%`);
        growthData.push({
          date: current.date,
          value: growth
        });
      }
    }

    console.log(`📊 YoY Growth: Generated ${growthData.length} data points`);
    return growthData;
  }

  calculatePERatio(dailyPrices, quarterlyFundamentals) {
    if (!dailyPrices.length || !quarterlyFundamentals.length) return [];

    const peData = [];
    
    quarterlyFundamentals.forEach(fundamental => {
      // Use EPS if available (from Alpha Vantage earnings data), otherwise skip
      if (!fundamental.eps || fundamental.eps <= 0) return;

      // Find closest price data to the fiscal date ending
      const fiscalDate = new Date(fundamental.fiscal_date_ending);
      const closestPrice = dailyPrices.reduce((closest, price) => {
        const priceDate = new Date(price.date);
        const currentDiff = Math.abs(priceDate - fiscalDate);
        const closestDiff = Math.abs(new Date(closest.date) - fiscalDate);
        
        return currentDiff < closestDiff ? price : closest;
      });

      if (closestPrice) {
        // Use split-adjusted price if available
        const priceToUse = closestPrice.adjusted_close || closestPrice.close;
        
        // Calculate TTM EPS (sum of last 4 quarters) 
        const fiscalIndex = quarterlyFundamentals.findIndex(f => 
          f.fiscal_date_ending === fundamental.fiscal_date_ending
        );
        
        if (fiscalIndex >= 3) {
          const ttmEps = quarterlyFundamentals
            .slice(fiscalIndex - 3, fiscalIndex + 1)
            .reduce((sum, f) => sum + (f.eps || 0), 0);

          if (ttmEps > 0) {
            peData.push({
              date: fundamental.reported_date || fundamental.fiscal_date_ending,
              value: priceToUse / ttmEps
            });
          }
        }
      }
    });

    return peData;
  }
}

module.exports = new StockDataService();