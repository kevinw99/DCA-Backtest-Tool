const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'stocks.db');

class NvdaSplitAdjuster {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database for NVDA split adjustment');
      }
    });
  }

  async adjustSplits() {
    console.log('Starting NVDA split adjustment...');

    try {
      // Get NVDA stock ID
      const nvdaId = await this.getNvdaId();
      if (!nvdaId) {
        throw new Error('NVDA not found in database');
      }

      console.log(`Found NVDA with ID: ${nvdaId}`);

      // Step 1: Update split coefficients
      await this.updateSplitCoefficients(nvdaId);

      // Step 2: Adjust pre-split prices
      await this.adjustPreSplitPrices(nvdaId);

      console.log('NVDA split adjustment completed successfully!');

    } catch (error) {
      console.error('Error during split adjustment:', error);
    } finally {
      this.db.close();
    }
  }

  getNvdaId() {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT id FROM stocks WHERE symbol = 'NVDA'",
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.id : null);
        }
      );
    });
  }

  updateSplitCoefficients(stockId) {
    return new Promise((resolve, reject) => {
      console.log('Updating split coefficients...');

      this.db.serialize(() => {
        // Update split coefficient for July 20, 2021 (4:1 split)
        this.db.run(
          `UPDATE daily_prices
           SET split_coefficient = 4.0
           WHERE stock_id = ? AND date = '2021-07-20'`,
          [stockId],
          function(err) {
            if (err) {
              console.error('Error updating 2021 split coefficient:', err);
            } else {
              console.log(`Updated 2021-07-20 split coefficient (4:1). Rows affected: ${this.changes}`);
            }
          }
        );

        // Update split coefficient for June 10, 2024 (10:1 split)
        this.db.run(
          `UPDATE daily_prices
           SET split_coefficient = 10.0
           WHERE stock_id = ? AND date = '2024-06-10'`,
          [stockId],
          function(err) {
            if (err) {
              console.error('Error updating 2024 split coefficient:', err);
              reject(err);
            } else {
              console.log(`Updated 2024-06-10 split coefficient (10:1). Rows affected: ${this.changes}`);
              resolve();
            }
          }
        );
      });
    });
  }

  adjustPreSplitPrices(stockId) {
    return new Promise((resolve, reject) => {
      console.log('Adjusting historical prices for splits...');

      this.db.serialize(() => {
        // First, adjust all prices before June 10, 2024 for the 10:1 split
        this.db.run(
          `UPDATE daily_prices
           SET
             open = open / 10.0,
             high = high / 10.0,
             low = low / 10.0,
             close = close / 10.0,
             adjusted_close = adjusted_close / 10.0,
             volume = volume * 10
           WHERE stock_id = ? AND date < '2024-06-10'`,
          [stockId],
          function(err) {
            if (err) {
              console.error('Error adjusting prices for 2024 split:', err);
            } else {
              console.log(`Adjusted prices for 2024 10:1 split. Rows affected: ${this.changes}`);
            }
          }
        );

        // Then, adjust all prices before July 20, 2021 for the 4:1 split
        this.db.run(
          `UPDATE daily_prices
           SET
             open = open / 4.0,
             high = high / 4.0,
             low = low / 4.0,
             close = close / 4.0,
             adjusted_close = adjusted_close / 4.0,
             volume = volume * 4
           WHERE stock_id = ? AND date < '2021-07-20'`,
          [stockId],
          function(err) {
            if (err) {
              console.error('Error adjusting prices for 2021 split:', err);
              reject(err);
            } else {
              console.log(`Adjusted prices for 2021 4:1 split. Rows affected: ${this.changes}`);
              resolve();
            }
          }
        );
      });
    });
  }

  // Verification method to check adjustments
  async verifyAdjustments(stockId) {
    return new Promise((resolve, reject) => {
      console.log('\nVerifying split adjustments...');

      // Check data around split dates
      const queries = [
        {
          name: 'July 2021 split area',
          query: `SELECT date, close, split_coefficient FROM daily_prices
                  WHERE stock_id = ? AND date BETWEEN '2021-07-19' AND '2021-07-21'
                  ORDER BY date`
        },
        {
          name: 'June 2024 split area',
          query: `SELECT date, close, split_coefficient FROM daily_prices
                  WHERE stock_id = ? AND date BETWEEN '2024-06-07' AND '2024-06-11'
                  ORDER BY date`
        }
      ];

      queries.forEach((q, index) => {
        this.db.all(q.query, [stockId], (err, rows) => {
          if (err) {
            console.error(`Error in verification query ${q.name}:`, err);
          } else {
            console.log(`\n${q.name}:`);
            rows.forEach(row => {
              console.log(`  ${row.date}: $${row.close.toFixed(2)} (split: ${row.split_coefficient})`);
            });

            if (index === queries.length - 1) {
              resolve();
            }
          }
        });
      });
    });
  }
}

// Run the adjustment
const adjuster = new NvdaSplitAdjuster();
adjuster.adjustSplits();
