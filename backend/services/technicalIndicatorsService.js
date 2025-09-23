const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TechnicalIndicatorsService {
  constructor() {
    const dbPath = path.join(__dirname, '../stocks.db');
    this.db = new sqlite3.Database(dbPath);
  }

  // Calculate all indicators for a stock
  async calculateIndicatorsForStock(stockId) {
    console.log(`Calculating technical indicators for stock ID: ${stockId}`);

    try {
      // Get all price data for the stock, ordered by date
      const prices = await this.getPriceData(stockId);
      console.log(`Retrieved ${prices.length} price records`);

      const indicators = [];

      // Calculate indicators for each day
      for (let i = 0; i < prices.length; i++) {
        const dayIndicators = this.calculateDayIndicators(prices, i);
        if (dayIndicators) {
          indicators.push({
            stock_id: stockId,
            date: prices[i].date,
            ...dayIndicators
          });
        }
      }

      // Batch insert indicators
      await this.insertIndicators(indicators);
      console.log(`Inserted ${indicators.length} indicator records`);

      return indicators.length;
    } catch (error) {
      console.error('Error calculating indicators:', error);
      throw error;
    }
  }

  // Get price data for a stock
  getPriceData(stockId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT date, open, high, low, close, adjusted_close, volume
        FROM daily_prices
        WHERE stock_id = ?
        ORDER BY date ASC
      `;

      this.db.all(sql, [stockId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Calculate all indicators for a specific day
  calculateDayIndicators(prices, endIndex) {
    const currentPrice = prices[endIndex];

    // Need minimum data for calculations
    if (endIndex < 20) return null;

    return {
      // Moving averages
      ma_5: this.calculateMA(prices, endIndex, 5),
      ma_10: this.calculateMA(prices, endIndex, 10),
      ma_20: this.calculateMA(prices, endIndex, 20),
      ma_50: this.calculateMA(prices, endIndex, 50),
      ma_200: this.calculateMA(prices, endIndex, 200),

      // RSI
      rsi_14: this.calculateRSI(prices, endIndex, 14),

      // Volatility
      volatility_20: this.calculateVolatility(prices, endIndex, 20),

      // Weekly trend
      weekly_trend: this.calculateWeeklyTrend(prices, endIndex),

      // Volume indicators
      avg_volume_20: this.calculateAvgVolume(prices, endIndex, 20),
      volume_ratio: this.calculateVolumeRatio(prices, endIndex, 20),

      // Market regime indicators
      price_vs_ma20: this.calculatePriceVsMA(prices, endIndex, 20),
      price_vs_ma200: this.calculatePriceVsMA(prices, endIndex, 200),
      ma50_vs_ma200: this.calculateMAvsMA(prices, endIndex, 50, 200),

      // Support/Resistance
      support_50: this.calculateSupport(prices, endIndex, 50),
      resistance_50: this.calculateResistance(prices, endIndex, 50)
    };
  }

  // Technical indicator calculation methods (reusing your existing logic)
  calculateMA(prices, endIndex, periods) {
    if (endIndex < periods - 1) return null;

    let sum = 0;
    for (let i = endIndex - periods + 1; i <= endIndex; i++) {
      sum += prices[i].adjusted_close;
    }
    return sum / periods;
  }

  calculateRSI(prices, endIndex, periods = 14) {
    if (endIndex < periods) return null;

    let gains = 0;
    let losses = 0;

    for (let i = endIndex - periods + 1; i <= endIndex; i++) {
      const change = prices[i].adjusted_close - prices[i-1].adjusted_close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / periods;
    const avgLoss = losses / periods;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateVolatility(prices, endIndex, periods = 20) {
    if (endIndex < periods) return null;

    const returns = [];
    for (let i = endIndex - periods + 1; i <= endIndex; i++) {
      if (i > 0) {
        const dailyReturn = (prices[i].adjusted_close - prices[i-1].adjusted_close) / prices[i-1].adjusted_close;
        returns.push(dailyReturn);
      }
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  calculateWeeklyTrend(prices, endIndex) {
    if (endIndex < 5) return 'neutral';

    const currentPrice = prices[endIndex].adjusted_close;
    const weekAgoPrice = prices[endIndex - 5].adjusted_close;
    const weeklyReturn = (currentPrice - weekAgoPrice) / weekAgoPrice;

    if (weeklyReturn > 0.02) return 'bullish';
    if (weeklyReturn < -0.02) return 'bearish';
    return 'neutral';
  }

  calculateAvgVolume(prices, endIndex, periods = 20) {
    if (endIndex < periods - 1) return null;

    let sum = 0;
    let count = 0;
    for (let i = endIndex - periods + 1; i <= endIndex; i++) {
      if (prices[i].volume) {
        sum += prices[i].volume;
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  }

  calculateVolumeRatio(prices, endIndex, periods = 20) {
    const avgVolume = this.calculateAvgVolume(prices, endIndex, periods);
    const currentVolume = prices[endIndex].volume;

    if (!avgVolume || !currentVolume) return null;
    return currentVolume / avgVolume;
  }

  calculatePriceVsMA(prices, endIndex, periods) {
    const ma = this.calculateMA(prices, endIndex, periods);
    if (!ma) return null;

    const currentPrice = prices[endIndex].adjusted_close;
    return (currentPrice - ma) / ma;
  }

  calculateMAvsMA(prices, endIndex, shortPeriods, longPeriods) {
    const shortMA = this.calculateMA(prices, endIndex, shortPeriods);
    const longMA = this.calculateMA(prices, endIndex, longPeriods);

    if (!shortMA || !longMA) return null;
    return (shortMA - longMA) / longMA;
  }

  calculateSupport(prices, endIndex, lookback = 50) {
    if (endIndex < lookback) return null;

    let lowestPrice = Infinity;
    for (let i = endIndex - lookback + 1; i <= endIndex; i++) {
      lowestPrice = Math.min(lowestPrice, prices[i].adjusted_close);
    }
    return lowestPrice;
  }

  calculateResistance(prices, endIndex, lookback = 50) {
    if (endIndex < lookback) return null;

    let highestPrice = 0;
    for (let i = endIndex - lookback + 1; i <= endIndex; i++) {
      highestPrice = Math.max(highestPrice, prices[i].adjusted_close);
    }
    return highestPrice;
  }

  // Batch insert indicators
  insertIndicators(indicators) {
    return new Promise((resolve, reject) => {
      // Clear existing indicators for this stock first
      const deleteSQL = `DELETE FROM technical_indicators WHERE stock_id = ?`;
      const stockId = indicators[0]?.stock_id;

      this.db.run(deleteSQL, [stockId], (deleteErr) => {
        if (deleteErr) {
          reject(deleteErr);
          return;
        }

        const insertSQL = `
          INSERT INTO technical_indicators (
            stock_id, date, ma_5, ma_10, ma_20, ma_50, ma_200,
            rsi_14, volatility_20, weekly_trend, avg_volume_20, volume_ratio,
            price_vs_ma20, price_vs_ma200, ma50_vs_ma200, support_50, resistance_50
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const stmt = this.db.prepare(insertSQL);
        let completed = 0;
        let hasError = false;

        indicators.forEach((indicator) => {
          stmt.run([
            indicator.stock_id, indicator.date, indicator.ma_5, indicator.ma_10,
            indicator.ma_20, indicator.ma_50, indicator.ma_200, indicator.rsi_14,
            indicator.volatility_20, indicator.weekly_trend, indicator.avg_volume_20,
            indicator.volume_ratio, indicator.price_vs_ma20, indicator.price_vs_ma200,
            indicator.ma50_vs_ma200, indicator.support_50, indicator.resistance_50
          ], (err) => {
            if (err && !hasError) {
              hasError = true;
              reject(err);
            }

            completed++;
            if (completed === indicators.length && !hasError) {
              stmt.finalize();
              resolve();
            }
          });
        });
      });
    });
  }

  // Calculate indicators for all stocks
  async calculateForAllStocks() {
    try {
      const stocks = await this.getAllStocks();
      console.log(`Found ${stocks.length} stocks to process`);

      for (const stock of stocks) {
        console.log(`Processing ${stock.symbol}...`);
        await this.calculateIndicatorsForStock(stock.id);
      }

      console.log('All technical indicators calculated successfully');
    } catch (error) {
      console.error('Error calculating indicators for all stocks:', error);
      throw error;
    }
  }

  getAllStocks() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT id, symbol FROM stocks ORDER BY symbol`;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    this.db.close();
  }
}

// Run if called directly
if (require.main === module) {
  const service = new TechnicalIndicatorsService();

  service.calculateForAllStocks()
    .then(() => {
      console.log('Technical indicators calculation complete');
      service.close();
    })
    .catch(err => {
      console.error('Error:', err);
      service.close();
    });
}

module.exports = TechnicalIndicatorsService;
