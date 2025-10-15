import React from 'react';
import { DollarSign, Package } from 'lucide-react';
import './PortfolioCurrentHoldings.css';

const PortfolioCurrentHoldings = ({ stockResults }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Filter stocks that have current holdings (lots held > 0)
  const stocksWithHoldings = stockResults.filter(stock => stock.lotsHeld > 0);

  // Calculate totals
  const totalMarketValue = stocksWithHoldings.reduce((sum, stock) => sum + (stock.marketValue || 0), 0);
  const totalCapitalDeployed = stocksWithHoldings.reduce((sum, stock) => sum + (stock.capitalDeployed || 0), 0);
  const totalUnrealizedPNL = totalMarketValue - totalCapitalDeployed;

  if (stocksWithHoldings.length === 0) {
    return (
      <div className="portfolio-holdings empty">
        <p>No current holdings - all positions have been closed</p>
      </div>
    );
  }

  return (
    <div className="portfolio-holdings">
      <div className="holdings-summary">
        <div className="summary-item">
          <span className="summary-label">Total Market Value:</span>
          <span className="summary-value">{formatCurrency(totalMarketValue)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Capital Deployed:</span>
          <span className="summary-value">{formatCurrency(totalCapitalDeployed)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Unrealized P&L:</span>
          <span className={`summary-value ${totalUnrealizedPNL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(totalUnrealizedPNL)}
          </span>
        </div>
      </div>

      <div className="holdings-by-stock">
        {stocksWithHoldings.map((stock) => {
          // Get the latest price from price data (last close price)
          const currentPrice = stock.priceData && stock.priceData.length > 0
            ? stock.priceData[stock.priceData.length - 1].close
            : 0;

          // Extract lots from transactions
          // We need to reconstruct lots from buy transactions that haven't been fully sold
          const buyTransactions = stock.transactions.filter(t => t.type.includes('BUY'));
          const sellTransactions = stock.transactions.filter(t => t.type.includes('SELL'));

          // Build a list of remaining lots
          const remainingLots = [];
          buyTransactions.forEach(buy => {
            let remainingShares = buy.shares || buy.quantity || 0;
            const buyPrice = buy.price || 0;
            const buyDate = buy.date;

            // Check if this lot was sold
            sellTransactions.forEach(sell => {
              if (sell.lotsDetails && Array.isArray(sell.lotsDetails)) {
                sell.lotsDetails.forEach(soldLot => {
                  if (Math.abs(soldLot.price - buyPrice) < 0.01 && soldLot.date === buyDate) {
                    remainingShares -= (soldLot.shares || 0);
                  }
                });
              }
            });

            if (remainingShares > 0.0001) { // Account for floating point precision
              remainingLots.push({
                date: buyDate,
                price: buyPrice,
                shares: remainingShares
              });
            }
          });

          return (
            <div key={stock.symbol} className="stock-holdings">
              <div className="stock-holdings-header">
                <h4>
                  <Package size={18} />
                  {stock.symbol}
                </h4>
                <div className="stock-holdings-summary">
                  <span>{stock.lotsHeld} lots</span>
                  <span className="divider">•</span>
                  <span>{formatCurrency(stock.marketValue)} market value</span>
                  <span className="divider">•</span>
                  <span className={stock.unrealizedPNL >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(stock.unrealizedPNL)} unrealized P&L
                  </span>
                </div>
              </div>

              {remainingLots.length > 0 ? (
                <table className="lots-table">
                  <thead>
                    <tr>
                      <th>Purchase Date</th>
                      <th>Purchase Price</th>
                      <th>Shares</th>
                      <th>Current Price</th>
                      <th>Current Value</th>
                      <th>Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainingLots.map((lot, idx) => {
                      const currentValue = lot.shares * currentPrice;
                      const purchaseValue = lot.shares * lot.price;
                      const pnl = currentValue - purchaseValue;

                      return (
                        <tr key={idx}>
                          <td>{formatDate(lot.date)}</td>
                          <td>{formatCurrency(lot.price)}</td>
                          <td>{lot.shares.toFixed(4)}</td>
                          <td>{formatCurrency(currentPrice)}</td>
                          <td>{formatCurrency(currentValue)}</td>
                          <td className={pnl >= 0 ? 'positive' : 'negative'}>
                            {formatCurrency(pnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="no-lot-details">Lot details not available</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortfolioCurrentHoldings;
