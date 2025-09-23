const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'stocks.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initializeTables();
      }
    });
  }

  initializeTables() {
    const createTables = [
      `CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT,
        last_updated DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS daily_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        date DATE NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        adjusted_close REAL,
        volume INTEGER,
        dividend_amount REAL DEFAULT 0,
        split_coefficient REAL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks (id),
        UNIQUE(stock_id, date)
      )`,
      
      `CREATE TABLE IF NOT EXISTS quarterly_fundamentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        fiscal_date_ending DATE NOT NULL,
        reported_date DATE,
        revenue REAL,
        gross_profit REAL,
        operating_income REAL,
        net_income REAL,
        eps REAL,
        shares_outstanding REAL,
        estimated_eps REAL,
        estimated_revenue REAL,
        eps_surprise_amount REAL,
        eps_surprise_percent REAL,
        revenue_surprise_amount REAL,
        revenue_surprise_percent REAL,
        yoy_revenue_growth_percent REAL,
        yoy_eps_growth_percent REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks (id),
        UNIQUE(stock_id, fiscal_date_ending)
      )`,
      
      `CREATE TABLE IF NOT EXISTS corporate_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        action_date DATE NOT NULL,
        action_type TEXT NOT NULL,
        split_ratio TEXT,
        adjustment_factor REAL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks (id),
        UNIQUE(stock_id, action_date, action_type)
      )`,

      `CREATE TABLE IF NOT EXISTS technical_indicators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        date DATE NOT NULL,
        ma_5 REAL,
        ma_10 REAL,
        ma_20 REAL,
        ma_50 REAL,
        ma_200 REAL,
        rsi_14 REAL,
        volatility_20 REAL,
        weekly_trend TEXT,
        avg_volume_20 REAL,
        volume_ratio REAL,
        price_vs_ma20 REAL,
        price_vs_ma200 REAL,
        ma50_vs_ma200 REAL,
        support_50 REAL,
        resistance_50 REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks (id),
        UNIQUE(stock_id, date)
      )`
    ];

    createTables.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      });
    });

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_daily_prices_stock_date ON daily_prices(stock_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_quarterly_fundamentals_stock_date ON quarterly_fundamentals(stock_id, fiscal_date_ending)',
      'CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_corporate_actions_stock_date ON corporate_actions(stock_id, action_date)',
      'CREATE INDEX IF NOT EXISTS idx_technical_indicators_stock_date ON technical_indicators(stock_id, date)'
    ];

    indexes.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('Error creating index:', err.message);
        }
      });
    });

    // Add new columns for YoY growth percentages (SQLite schema migration)
    this.addColumnIfNotExists('quarterly_fundamentals', 'yoy_revenue_growth_percent', 'REAL');
    this.addColumnIfNotExists('quarterly_fundamentals', 'yoy_eps_growth_percent', 'REAL');
    
    // Add new columns for Alpha Vantage adjusted data (SQLite schema migration)
    this.addColumnIfNotExists('daily_prices', 'adjusted_close', 'REAL');
    this.addColumnIfNotExists('daily_prices', 'dividend_amount', 'REAL DEFAULT 0');
    this.addColumnIfNotExists('daily_prices', 'split_coefficient', 'REAL DEFAULT 1');
  }

  addColumnIfNotExists(tableName, columnName, columnType) {
    // Check if column exists
    this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        console.error(`Error checking table info for ${tableName}:`, err.message);
        return;
      }

      const columnExists = rows.some(row => row.name === columnName);
      
      if (!columnExists) {
        console.log(`Adding column ${columnName} to table ${tableName}`);
        this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`, (err) => {
          if (err) {
            console.error(`Error adding column ${columnName}:`, err.message);
          } else {
            console.log(`✅ Successfully added column ${columnName} to ${tableName}`);
          }
        });
      }
    });
  }

  // Stock operations
  async getStock(symbol) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM stocks WHERE symbol = ?', [symbol.toUpperCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createStock(symbol, name = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO stocks (symbol, name) VALUES (?, ?)',
        [symbol.toUpperCase(), name],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateStockTimestamp(stockId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE stocks SET last_updated = CURRENT_DATE WHERE id = ?',
        [stockId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Daily prices operations
  async getDailyPrices(stockId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM daily_prices WHERE stock_id = ?';
      let params = [stockId];

      if (startDate) {
        sql += ' AND date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND date <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY date ASC';

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async insertDailyPrices(stockId, pricesData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO daily_prices 
        (stock_id, date, open, high, low, close, adjusted_close, volume, dividend_amount, split_coefficient) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        pricesData.forEach(price => {
          stmt.run([
            stockId,
            price.date,
            price.open || null,
            price.high || null,
            price.low || null,
            price.close || null,
            price.adjusted_close || price.close || null, // Use adjusted_close if available, fallback to close
            price.volume || null,
            price.dividend_amount || 0,
            price.split_coefficient || 1
          ]);
        });

        stmt.finalize();
        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(pricesData.length);
        });
      });
    });
  }

  // Quarterly fundamentals operations
  async getQuarterlyFundamentals(stockId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM quarterly_fundamentals WHERE stock_id = ?';
      let params = [stockId];

      if (startDate) {
        sql += ' AND fiscal_date_ending >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND fiscal_date_ending <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY fiscal_date_ending ASC';

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async insertQuarterlyFundamentals(stockId, fundamentalsData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO quarterly_fundamentals 
        (stock_id, fiscal_date_ending, reported_date, revenue, gross_profit, 
         operating_income, net_income, eps, shares_outstanding, estimated_eps, 
         estimated_revenue, eps_surprise_amount, eps_surprise_percent, 
         revenue_surprise_amount, revenue_surprise_percent, yoy_revenue_growth_percent, yoy_eps_growth_percent) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        fundamentalsData.forEach(data => {
          stmt.run([
            stockId,
            data.fiscal_date_ending,
            data.reported_date || null,
            data.revenue || null,
            data.gross_profit || null,
            data.operating_income || null,
            data.net_income || null,
            data.eps || null,
            data.shares_outstanding || null,
            data.estimated_eps || null,
            data.estimated_revenue || null,
            data.eps_surprise_amount || null,
            data.eps_surprise_percent || null,
            data.revenue_surprise_amount || null,
            data.revenue_surprise_percent || null,
            data.yoy_revenue_growth_percent || null,
            data.yoy_eps_growth_percent || null
          ]);
        });

        stmt.finalize();
        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(fundamentalsData.length);
        });
      });
    });
  }

  // Corporate actions operations
  async getCorporateActions(stockId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM corporate_actions WHERE stock_id = ?';
      let params = [stockId];

      if (startDate) {
        sql += ' AND action_date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND action_date <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY action_date ASC';

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async insertCorporateActions(stockId, actionsData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO corporate_actions 
        (stock_id, action_date, action_type, split_ratio, adjustment_factor, description) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        actionsData.forEach(action => {
          stmt.run([
            stockId,
            action.action_date,
            action.action_type,
            action.split_ratio || null,
            action.adjustment_factor || null,
            action.description || null
          ]);
        });

        stmt.finalize();
        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve(actionsData.length);
        });
      });
    });
  }

  async getSplitAdjustedPrices(stockId, startDate = null, endDate = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get all prices and corporate actions
        const prices = await this.getDailyPrices(stockId, startDate, endDate);
        const corporateActions = await this.getCorporateActions(stockId);
        
        // Filter for splits only
        const splits = corporateActions.filter(action => action.action_type === 'SPLIT');
        
        console.log(`Found ${splits.length} splits for stock ID ${stockId}:`, splits);
        
        if (splits.length === 0) {
          // No splits, return original prices with adjusted fields
          const adjustedPrices = prices.map(price => ({
            ...price,
            adjusted_open: price.open,
            adjusted_high: price.high,
            adjusted_low: price.low,
            adjusted_close: price.close
          }));
          resolve(adjustedPrices);
          return;
        }

        // Sort splits by date (oldest first)
        splits.sort((a, b) => new Date(a.action_date) - new Date(b.action_date));
        console.log(`Sorted splits:`, splits.map(s => `${s.action_date}: ${s.split_ratio} (factor: ${s.adjustment_factor})`));
        
        // Apply split adjustments retroactively (backward adjustment)
        const adjustedPrices = prices.map(price => {
          let cumulativeAdjustment = 1;
          
          // Find all splits that occurred AFTER this price date
          const laterSplits = splits.filter(split => 
            new Date(split.action_date) > new Date(price.date)
          );
          
          // Apply all later splits to this historical price (multiply by factors)
          laterSplits.forEach(split => {
            if (split.adjustment_factor) {
              // For backward adjustment: multiply historical prices by adjustment factors
              // This makes historical prices appear lower to show continuity
              cumulativeAdjustment *= split.adjustment_factor;
            }
          });
          
          console.log(`Price ${price.date}: $${price.close} -> $${price.close ? (price.close * cumulativeAdjustment).toFixed(2) : 'N/A'} (factor: ${cumulativeAdjustment.toFixed(4)})`);
          
          return {
            ...price,
            adjusted_open: price.open ? price.open * cumulativeAdjustment : null,
            adjusted_high: price.high ? price.high * cumulativeAdjustment : null,
            adjusted_low: price.low ? price.low * cumulativeAdjustment : null,
            adjusted_close: price.close ? price.close * cumulativeAdjustment : null
          };
        });
        
        resolve(adjustedPrices);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get technical indicators for a stock within a date range
  getTechnicalIndicators(stockId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM technical_indicators
        WHERE stock_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
      `;

      this.db.all(sql, [stockId, startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get combined price and technical indicator data
  getPricesWithIndicators(stockId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT
          p.date, p.open, p.high, p.low, p.close, p.adjusted_close, p.volume,
          t.ma_5, t.ma_10, t.ma_20, t.ma_50, t.ma_200,
          t.rsi_14, t.volatility_20, t.weekly_trend, t.avg_volume_20, t.volume_ratio,
          t.price_vs_ma20, t.price_vs_ma200, t.ma50_vs_ma200, t.support_50, t.resistance_50
        FROM daily_prices p
        LEFT JOIN technical_indicators t ON p.stock_id = t.stock_id AND p.date = t.date
        WHERE p.stock_id = ?
      `;

      let params = [stockId];

      // Only add date filters if they are provided
      if (startDate) {
        sql += ' AND p.date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND p.date <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY p.date ASC';

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Utility methods
  async getLastPriceDate(stockId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(date) as last_date FROM daily_prices WHERE stock_id = ?',
        [stockId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.last_date || null);
        }
      );
    });
  }

  async getLastFundamentalDate(stockId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(fiscal_date_ending) as last_date FROM quarterly_fundamentals WHERE stock_id = ?',
        [stockId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.last_date || null);
        }
      );
    });
  }

  async getLastCorporateActionDate(stockId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(action_date) as last_date FROM corporate_actions WHERE stock_id = ?',
        [stockId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.last_date || null);
        }
      );
    });
  }

  // Data invalidation methods (for development use)
  async clearDailyPrices(stockId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM daily_prices WHERE stock_id = ?',
        [stockId],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`    Deleted ${this.changes} daily price records`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  async clearQuarterlyFundamentals(stockId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM quarterly_fundamentals WHERE stock_id = ?',
        [stockId],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`    Deleted ${this.changes} quarterly fundamental records`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  async clearCorporateActions(stockId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM corporate_actions WHERE stock_id = ?',
        [stockId],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`    Deleted ${this.changes} corporate action records`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // Clear all data from database
  async clearAllData() {
    return new Promise((resolve, reject) => {
      const db = this.db; // Capture db reference
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const tables = ['daily_prices', 'quarterly_fundamentals', 'corporate_actions', 'stocks'];
        let deletedCounts = {};
        let completed = 0;
        
        tables.forEach(table => {
          db.run(`DELETE FROM ${table}`, function(err) {
            if (err) {
              console.error(`Error clearing ${table}:`, err.message);
              reject(err);
              return;
            }
            
            deletedCounts[table] = this.changes;
            console.log(`🗑️  Cleared ${this.changes} records from ${table}`);
            completed++;
            
            if (completed === tables.length) {
              // Commit transaction
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err.message);
                  reject(err);
                } else {
                  console.log('✅ Successfully cleared all data from database');
                  resolve(deletedCounts);
                }
              });
            }
          });
        });
      });
    });
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = new Database();
