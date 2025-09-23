const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../stocks.db');
const db = new sqlite3.Database(dbPath);

// Create technical indicators table
const createTechnicalIndicatorsTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS technical_indicators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        date DATE NOT NULL,

        -- Moving Averages
        ma_5 REAL,
        ma_10 REAL,
        ma_20 REAL,
        ma_50 REAL,
        ma_200 REAL,

        -- RSI
        rsi_14 REAL,

        -- Volatility (20-day annualized)
        volatility_20 REAL,

        -- Weekly trend
        weekly_trend TEXT, -- 'bullish', 'bearish', 'neutral'

        -- Volume indicators
        avg_volume_20 REAL,
        volume_ratio REAL, -- current volume / avg volume

        -- Market regime indicators
        price_vs_ma20 REAL, -- (price - ma20) / ma20
        price_vs_ma200 REAL, -- (price - ma200) / ma200
        ma50_vs_ma200 REAL, -- (ma50 - ma200) / ma200

        -- Support/Resistance levels
        support_50 REAL,
        resistance_50 REAL,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (stock_id) REFERENCES stocks (id),
        UNIQUE(stock_id, date)
      );
    `;

    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Technical indicators table created successfully');

        // Create index for fast lookups
        const indexSql = `CREATE INDEX IF NOT EXISTS idx_technical_indicators_stock_date
                         ON technical_indicators(stock_id, date);`;

        db.run(indexSql, (indexErr) => {
          if (indexErr) {
            reject(indexErr);
          } else {
            console.log('Index created successfully');
            resolve();
          }
        });
      }
    });
  });
};

// Run if called directly
if (require.main === module) {
  createTechnicalIndicatorsTable()
    .then(() => {
      console.log('Setup complete');
      db.close();
    })
    .catch(err => {
      console.error('Error creating table:', err);
      db.close();
    });
}

module.exports = { createTechnicalIndicatorsTable };
