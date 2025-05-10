/**
 * Price Feed Service
 * 
 * This service manages price data for assets in the One Capital platform.
 * It provides both real-time and historical price data for portfolio valuation
 * and rebalancing calculations.
 */

import { storage } from '../storage';
import { PriceFeed, InsertPriceFeed } from '@shared/schema';

// Simulated price data for testing
const SIMULATED_PRICES: Record<string, number> = {
  BTC: 65421.37,
  ETH: 3512.89,
  L1X: 28.76,
  USDC: 1.0,
  USDT: 1.0,
  SOL: 142.67,
  AVAX: 34.95,
  MATIC: 0.78
};

// Historical prices with some volatility for 24h change calculation
const PREVIOUS_PRICES: Record<string, number> = {};

/**
 * Get the current price for a specific asset
 * 
 * @param symbol Asset symbol (e.g., "BTC")
 * @returns Current price or null if not available
 */
export async function getPrice(symbol: string): Promise<number | null> {
  try {
    // In production, this would fetch from a real price oracle
    // For now, use simulated prices
    const price = SIMULATED_PRICES[symbol];
    
    if (price === undefined) {
      return null;
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get prices for multiple assets
 * 
 * @param symbols Array of asset symbols
 * @returns Record of symbol to price
 */
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  await Promise.all(
    symbols.map(async (symbol) => {
      const price = await getPrice(symbol);
      if (price !== null) {
        result[symbol] = price;
      }
    })
  );
  
  return result;
}

/**
 * Get price with 24h change information
 * 
 * @param symbol Asset symbol
 * @returns Price with change data or null
 */
export async function getPriceWithChange(symbol: string): Promise<{
  current: number;
  previous24h: number;
  change24h: number;
  changePercentage24h: number;
} | null> {
  try {
    const currentPrice = await getPrice(symbol);
    
    if (currentPrice === null) {
      return null;
    }
    
    // Generate a random previous price for simulation if not available
    // In production, this would come from historical price data
    if (!PREVIOUS_PRICES[symbol]) {
      // Random change between -15% and +15%
      const randomFactor = 1 + ((Math.random() * 0.3) - 0.15);
      PREVIOUS_PRICES[symbol] = currentPrice * randomFactor;
    }
    
    const previous24h = PREVIOUS_PRICES[symbol];
    const change24h = currentPrice - previous24h;
    const changePercentage24h = (change24h / previous24h) * 100;
    
    return {
      current: currentPrice,
      previous24h,
      change24h,
      changePercentage24h
    };
  } catch (error) {
    console.error(`Error fetching price data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get prices with 24h change information for multiple assets
 * 
 * @param symbols Array of asset symbols
 * @returns Record of symbol to price data
 */
export async function getPricesWithChange(
  symbols: string[] = Object.keys(SIMULATED_PRICES)
): Promise<Record<string, {
  current: number;
  previous24h: number;
  change24h: number;
  changePercentage24h: number;
}>> {
  const result: Record<string, any> = {};
  
  await Promise.all(
    symbols.map(async (symbol) => {
      const priceData = await getPriceWithChange(symbol);
      if (priceData !== null) {
        result[symbol] = priceData;
      }
    })
  );
  
  return result;
}

/**
 * Store a price feed entry in the database
 * 
 * @param assetSymbol Asset symbol
 * @param price Current price
 * @returns Created price feed entry
 */
export async function storePriceFeed(assetSymbol: string, price: number): Promise<PriceFeed | null> {
  try {
    const asset = await storage.getAssetBySymbol(assetSymbol);
    
    if (!asset) {
      console.error(`Cannot store price feed: Asset with symbol ${assetSymbol} not found`);
      return null;
    }
    
    const priceFeedData: InsertPriceFeed = {
      assetId: asset.id,
      price: price.toString(),
      source: 'oracle',
      timestamp: new Date()
    };
    
    return await storage.createPriceFeed(priceFeedData);
  } catch (error) {
    console.error(`Error storing price feed for ${assetSymbol}:`, error);
    return null;
  }
}

/**
 * Update prices from an external oracle
 * This would be called periodically or via webhook in production
 * 
 * @param priceData Map of asset symbols to prices
 * @returns Success status and details
 */
export async function updatePricesFromOracle(
  priceData: Record<string, number>
): Promise<{ success: boolean; details: string }> {
  try {
    const results = [];
    
    for (const [symbol, price] of Object.entries(priceData)) {
      // Update the local cache
      SIMULATED_PRICES[symbol] = price;
      
      // Store in database
      const priceFeed = await storePriceFeed(symbol, price);
      results.push({
        symbol,
        price,
        stored: !!priceFeed
      });
    }
    
    return {
      success: true,
      details: `Updated prices for ${results.length} assets`
    };
  } catch (error) {
    console.error('Error updating prices from oracle:', error);
    return {
      success: false,
      details: `Error updating prices: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}