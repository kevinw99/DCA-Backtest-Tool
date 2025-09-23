const database = require('../database');
const stockDataService = require('../services/stockDataService');

async function updateExistingStockData() {
  console.log('Starting update of existing stock data with corporate actions...');
  
  try {
    // Get all existing stocks
    const stocks = await database.db.all('SELECT * FROM stocks');
    console.log(`Found ${stocks.length} stocks to update`);

    for (const stock of stocks) {
      console.log(`\nUpdating ${stock.symbol}...`);
      
      try {
        // Force update corporate actions for existing stocks
        await stockDataService.updateStockData(stock.id, stock.symbol, {
          updatePrices: false,
          updateFundamentals: false,
          updateCorporateActions: true
        });
        
        console.log(`✅ Successfully updated ${stock.symbol}`);
      } catch (error) {
        console.error(`❌ Error updating ${stock.symbol}:`, error.message);
      }
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ Finished updating existing stock data');
  } catch (error) {
    console.error('❌ Error updating existing data:', error);
  } finally {
    database.close();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  updateExistingStockData();
}

module.exports = { updateExistingStockData };