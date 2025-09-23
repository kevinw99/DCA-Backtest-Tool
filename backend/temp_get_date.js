
const db = require('./database');

async function printLatestDate() {
  try {
    const stock = await db.getStock('TSLA');
    if (stock) {
      const lastDate = await db.getLastPriceDate(stock.id);
      console.log(`Last quote date for TSLA: ${lastDate}`);
    } else {
      console.log('TSLA not found in database.');
    }
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    db.close();
  }
}

printLatestDate();
