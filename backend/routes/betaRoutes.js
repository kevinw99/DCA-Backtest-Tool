/**
 * Beta API Routes (Spec 42)
 *
 * Endpoints for stock beta value management:
 * - GET /api/beta/:symbol - Get beta for single stock
 * - POST /api/beta/batch - Get betas for multiple stocks
 * - POST /api/beta/:symbol/refresh - Force refresh beta from provider
 */

const express = require('express');
const router = express.Router();
const betaService = require('../services/betaService');

/**
 * GET /api/beta/:symbol
 * Get beta value for a single stock
 *
 * Multi-tier resolution:
 * 1. backtestDefaults.json (file override)
 * 2. Database cache (if fresh)
 * 3. Provider API (Yahoo Finance)
 * 4. Database cache (if stale)
 * 5. Default (1.0)
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    // Validate symbol
    if (!symbol || !/^[A-Z]{1,5}$/i.test(symbol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol format. Symbol must be 1-5 letters.'
      });
    }

    console.log(`📡 GET /api/beta/${symbol}`);

    // Fetch beta with multi-tier resolution
    const betaData = await betaService.getBeta(symbol);

    // Calculate age if lastUpdated exists
    const age = betaData.lastUpdated
      ? betaService.calculateAge(betaData.lastUpdated)
      : null;

    // Check if stale
    const isStale = betaService.isBetaStale(betaData);

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        beta: betaData.beta,
        source: betaData.source,
        updatedAt: betaData.lastUpdated,
        age: age, // seconds
        providerName: betaData.providerName || betaData.source,
        isStale: isStale,
        metadata: betaData.metadata || {}
      }
    });

  } catch (error) {
    console.error(`Error in GET /api/beta/${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch beta'
    });
  }
});

/**
 * POST /api/beta/batch
 * Get beta values for multiple stocks in parallel
 *
 * Request body: { symbols: ["TSLA", "META", "AAPL"] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body;

    // Validate symbols array
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain "symbols" array with at least one symbol'
      });
    }

    // Validate symbol count (max 50 for performance)
    if (symbols.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 symbols allowed per batch request'
      });
    }

    // Validate each symbol format
    for (const symbol of symbols) {
      if (!symbol || !/^[A-Z]{1,5}$/i.test(symbol)) {
        return res.status(400).json({
          success: false,
          error: `Invalid symbol format: "${symbol}". Symbols must be 1-5 letters.`
        });
      }
    }

    console.log(`📡 POST /api/beta/batch - Fetching ${symbols.length} symbols`);

    // Fetch all betas in parallel
    const betaMap = await betaService.getBetaBatch(symbols);

    // Transform to response format
    const formattedData = {};
    const metadata = {
      totalRequested: symbols.length,
      fromFile: 0,
      fromCache: 0,
      fromProvider: 0,
      failed: 0
    };

    for (const [symbol, betaData] of Object.entries(betaMap)) {
      const age = betaData.lastUpdated
        ? betaService.calculateAge(betaData.lastUpdated)
        : null;

      const isStale = betaService.isBetaStale(betaData);

      formattedData[symbol] = {
        beta: betaData.beta,
        source: betaData.source,
        updatedAt: betaData.lastUpdated,
        age: age,
        providerName: betaData.providerName || betaData.source,
        isStale: isStale,
        metadata: betaData.metadata || {}
      };

      // Count sources
      if (betaData.source === 'file') {
        metadata.fromFile++;
      } else if (betaData.source.includes('cache')) {
        metadata.fromCache++;
      } else if (betaData.source.includes('yahoo') || betaData.source.includes('alpha')) {
        metadata.fromProvider++;
      } else if (betaData.source === 'default') {
        metadata.failed++;
      }
    }

    res.json({
      success: true,
      data: formattedData,
      metadata
    });

  } catch (error) {
    console.error('Error in POST /api/beta/batch:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch batch betas'
    });
  }
});

/**
 * POST /api/beta/:symbol/refresh
 * Force refresh beta from provider (bypass cache)
 *
 * Note: Cannot refresh file-based betas (must edit backtestDefaults.json)
 */
router.post('/:symbol/refresh', async (req, res) => {
  try {
    const { symbol } = req.params;

    // Validate symbol
    if (!symbol || !/^[A-Z]{1,5}$/i.test(symbol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol format. Symbol must be 1-5 letters.'
      });
    }

    console.log(`🔄 POST /api/beta/${symbol}/refresh - Force refreshing beta`);

    // Attempt to refresh beta
    const refreshedData = await betaService.refreshBeta(symbol);

    res.json({
      success: true,
      data: refreshedData
    });

  } catch (error) {
    console.error(`Error in POST /api/beta/${req.params.symbol}/refresh:`, error);

    // Special handling for file-based beta error
    if (error.message.includes('backtestDefaults.json')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        cannotRefresh: true
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh beta'
    });
  }
});

/**
 * GET /api/beta/
 * Get all cached betas (for debugging/monitoring)
 */
router.get('/', async (req, res) => {
  try {
    const database = require('../database');
    const allBetas = await database.getAllBetas();

    res.json({
      success: true,
      count: allBetas.length,
      data: allBetas
    });

  } catch (error) {
    console.error('Error in GET /api/beta/:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get all betas'
    });
  }
});

module.exports = router;
