/**
 * Price Feed Service for One Capital
 * 
 * This service manages asset price data including:
 * - Fetching prices from external APIs
 * - Caching prices to reduce API calls
 * - Providing consistent price data to the application
 * - Scheduled updates for price data
 */

import axios from 'axios';
import { storage } from '../storage';
import { InsertPriceFeed, Asset } from '@shared/schema';
import { log } from '../vite';

// Configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for prices to reduce external API calls
interface PriceCache {
  [symbol: string]: {
    price: number;
    lastUpdated: number;
  }
}

const priceCache: PriceCache = {};

// Symbol mapping for CoinGecko API
const COINGECKO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'DOT': 'polkadot',
  'SOL': 'solana',
  'AVAX': 'avalanche-2',
  'MATIC': 'polygon',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'L1X': 'layer-one-x', // For demo purposes
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai'
};

/**
 * Fetch price from CoinGecko API
 */
async function fetchPriceFromCoinGecko(symbol: string): Promise<number | null> {
  try {
    const id = getCoinGeckoId(symbol);
    if (!id) {
      log(`No CoinGecko ID mapping for symbol: ${symbol}`, 'priceFeed');
      return null;
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
    );

    if (response.data && response.data[id] && response.data[id].usd) {
      return response.data[id].usd;
    }
    
    log(`Invalid response format from CoinGecko for ${symbol}`, 'priceFeed');
    return null;
  } catch (error) {
    log(`Error fetching price from CoinGecko for ${symbol}: ${error}`, 'priceFeed');
    return null;
  }
}

/**
 * Get CoinGecko ID for a given token symbol
 */
function getCoinGeckoId(symbol: string): string | null {
  return COINGECKO_ID_MAP[symbol] || null;
}

/**
 * Get price for a specific token
 * First checks cache, then database, then external API
 */
export async function getPrice(symbol: string): Promise<number | null> {
  // Normalize symbol
  const normalizedSymbol = symbol.toUpperCase();
  
  // Check cache first
  const now = Date.now();
  const cached = priceCache[normalizedSymbol];
  if (cached && (now - cached.lastUpdated < CACHE_TTL_MS)) {
    return cached.price;
  }
  
  try {
    // Check if asset exists in our database
    const asset = await storage.getAssetBySymbol(normalizedSymbol);
    if (!asset) {
      log(`Asset with symbol ${normalizedSymbol} not found in database`, 'priceFeed');
      return null;
    }
    
    // Try to get latest price from database
    const latestPrice = await storage.getLatestPriceByAssetId(asset.id);
    if (latestPrice && (now - Number(latestPrice.timestamp) < CACHE_TTL_MS)) {
      // Cache and return the price from database
      priceCache[normalizedSymbol] = {
        price: latestPrice.price,
        lastUpdated: Number(latestPrice.timestamp)
      };
      return latestPrice.price;
    }
    
    // Fetch from external API
    const price = await fetchPriceFromCoinGecko(normalizedSymbol);
    if (price !== null) {
      // Cache the price
      priceCache[normalizedSymbol] = {
        price,
        lastUpdated: now
      };
      
      // Store in database
      const priceFeed: InsertPriceFeed = {
        assetId: asset.id,
        price,
        source: 'coingecko',
        timestamp: new Date().toISOString()
      };
      
      await storage.createPriceFeed(priceFeed);
      
      return price;
    }
    
    // If we get here, we failed to get a price
    return null;
  } catch (error) {
    log(`Error in getPrice for ${normalizedSymbol}: ${error}`, 'priceFeed');
    return null;
  }
}

/**
 * Get prices for multiple tokens
 */
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  // Process in parallel for efficiency
  const promises = symbols.map(async (symbol) => {
    const price = await getPrice(symbol);
    if (price !== null) {
      result[symbol] = price;
    }
  });
  
  await Promise.all(promises);
  return result;
}

/**
 * Get prices for all assets in the database
 */
export async function getAllAssetPrices(): Promise<Record<string, number>> {
  try {
    const assets = await storage.getAllAssets();
    const symbols = assets.map(asset => asset.symbol);
    return getPrices(symbols);
  } catch (error) {
    log(`Error getting all asset prices: ${error}`, 'priceFeed');
    return {};
  }
}

/**
 * Update on-chain prices via Oracle contract
 * This would integrate with our L1X price oracle contract
 */
export async function updateOnChainPrices(): Promise<void> {
  try {
    const prices = await getAllAssetPrices();
    
    // In a real implementation, we would:
    // 1. Connect to the L1X network
    // 2. Load the oracle contract
    // 3. Sign and submit transactions to update prices
    
    log(`Would update ${Object.keys(prices).length} prices on-chain`, 'priceFeed');
    
    // For demonstration purposes, we're just logging
    Object.entries(prices).forEach(([symbol, price]) => {
      log(`Would update ${symbol} price to $${price} on-chain`, 'priceFeed');
    });
  } catch (error) {
    log(`Error updating on-chain prices: ${error}`, 'priceFeed');
  }
}

/**
 * Schedule regular price updates
 */
export function schedulePriceUpdates(intervalMinutes = 10): NodeJS.Timer {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Initial update
  updateOnChainPrices();
  
  // Schedule regular updates
  return setInterval(() => {
    log('Running scheduled price update', 'priceFeed');
    updateOnChainPrices();
  }, intervalMs);
}