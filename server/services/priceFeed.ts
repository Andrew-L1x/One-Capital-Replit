/**
 * Price Feed Service
 * 
 * This service handles fetching and caching cryptocurrency price data.
 * It attempts to use the CoinGecko API if an API key is available,
 * and generates moderately randomized data for simulation purposes otherwise.
 */

import axios from 'axios';
import { storage } from '../storage';
import { Asset, InsertPriceFeed } from '@shared/schema';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// CoinGecko API configuration
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const PRICE_CACHE_DURATION = 60 * 1000; // 60 seconds

console.log(`CoinGecko API Key available: ${COINGECKO_API_KEY ? 'Yes' : 'No'}`); // Debugging

// Cache for price data
interface PriceCache {
  timestamp: number;
  data: Record<string, PriceData>;
}

// Price data structure
export interface PriceData {
  current: number;
  previous24h: number;
  change24h: number;
  changePercentage24h: number;
}

// Base prices for simulated data - these represent realistic starting points
const BASE_PRICES: Record<string, number> = {
  BTC: 65421.37,
  ETH: 3512.89,
  L1X: 28.76,
  USDC: 1,
  USDT: 1,
  SOL: 142.67,
  AVAX: 34.95,
  MATIC: 0.78,
  DOT: 7.56,
  ADA: 0.52,
  XRP: 0.56,
  DOGE: 0.17,
  SHIB: 0.000023,
  LINK: 14.87,
  ATOM: 10.23,
  UNI: 10.47,
  DAI: 1,
  LTC: 83.95,
  CRO: 0.12,
  ALGO: 0.19,
};

// Price cache
let priceCache: PriceCache = {
  timestamp: 0,
  data: {}
};

/**
 * Generate simulated price data with realistic variations
 * This is used when we don't have a CoinGecko API key or when the API is unavailable
 */
function generateSimulatedPrices(): Record<string, PriceData> {
  console.log('Generating simulated price data');
  
  const simulatedPrices: Record<string, PriceData> = {};
  const now = Date.now();
  
  // If we have cached data older than 24 hours, use it as previous data
  const useCache = priceCache.timestamp > 0 && (now - priceCache.timestamp) <= 24 * 60 * 60 * 1000;
  
  Object.entries(BASE_PRICES).forEach(([symbol, basePrice]) => {
    // Generate a variation between -0.5% and +0.5% of the base price
    // Use a smaller variation to avoid excessive price changes
    const variationPercent = (Math.random() * 1) - 0.5; // -0.5% to +0.5%
    const variation = basePrice * (variationPercent / 100);
    
    // Calculate current price with small variation
    const current = Number((basePrice + variation).toFixed(8));
    
    // Use previous cached price for previous24h if available, otherwise create a random one
    let previous24h;
    if (useCache && priceCache.data[symbol]) {
      previous24h = priceCache.data[symbol].current;
    } else {
      // Generate a variation between -10% and +10% for the 24h previous price
      const prevVariationPercent = (Math.random() * 20) - 10; // -10% to +10%
      previous24h = Number((basePrice * (1 + prevVariationPercent / 100)).toFixed(8));
    }
    
    // Calculate change values
    const change24h = Number((current - previous24h).toFixed(8));
    const changePercentage24h = Number(((change24h / previous24h) * 100).toFixed(4));
    
    // Store in simulated prices
    simulatedPrices[symbol] = {
      current,
      previous24h,
      change24h,
      changePercentage24h
    };
  });
  
  return simulatedPrices;
}

/**
 * Fetch prices from CoinGecko API
 */
async function fetchCoinGeckoPrices(): Promise<Record<string, PriceData> | null> {
  if (!COINGECKO_API_KEY) {
    console.log('No CoinGecko API key provided, returning null');
    return null;
  }
  
  try {
    console.log('Fetching prices from CoinGecko API');
    
    // Get all assets from database
    const assets = await storage.getAllAssets();
    if (!assets || assets.length === 0) {
      return null;
    }
    
    // Map asset symbols to CoinGecko IDs
    const cryptoIdMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'AVAX': 'avalanche-2',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'MATIC': 'matic-network',
      'DOT': 'polkadot',
      'ADA': 'cardano',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'SHIB': 'shiba-inu',
      'LINK': 'chainlink',
      'ATOM': 'cosmos',
      'UNI': 'uniswap',
      'DAI': 'dai',
      'LTC': 'litecoin',
      'CRO': 'crypto-com-chain',
      'ALGO': 'algorand',
      'L1X': 'l1x' // May need to be updated with actual CoinGecko ID
    };
    
    // Filter assets we have IDs for
    const coingeckoIds = assets
      .map(asset => cryptoIdMap[asset.symbol])
      .filter(id => id !== undefined);
    
    if (coingeckoIds.length === 0) {
      console.log('No valid CoinGecko IDs found for assets');
      return null;
    }
    
    // Current prices
    const currentResponse = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
      params: {
        ids: coingeckoIds.join(','),
        vs_currencies: 'usd',
        include_24hr_change: true,
        x_cg_pro_api_key: COINGECKO_API_KEY
      }
    });
    
    if (!currentResponse.data) {
      console.error('No data returned from CoinGecko API');
      return null;
    }
    
    // Map CoinGecko response to our format
    const prices: Record<string, PriceData> = {};
    
    // Reverse map to go from CoinGecko ID to our symbol
    const reverseIdMap: Record<string, string> = {};
    Object.entries(cryptoIdMap).forEach(([symbol, id]) => {
      reverseIdMap[id] = symbol;
    });
    
    // Process the response data
    Object.entries(currentResponse.data).forEach(([coingeckoId, priceData]: [string, any]) => {
      const symbol = reverseIdMap[coingeckoId];
      
      if (symbol) {
        const current = priceData.usd;
        const changePercentage24h = priceData.usd_24h_change || 0;
        const previous24h = current / (1 + changePercentage24h / 100);
        const change24h = current - previous24h;
        
        prices[symbol] = {
          current,
          previous24h,
          change24h,
          changePercentage24h
        };
        
        console.log(`Received price for ${symbol}: $${current} (${changePercentage24h.toFixed(2)}%)`);
      }
    });
    
    return prices;
    
  } catch (error) {
    console.error('Error fetching prices from CoinGecko:', error);
    return null;
  }
}

/**
 * Get cryptocurrency prices with change data
 * Attempts to use CoinGecko API if available, falls back to simulation if not
 */
export async function getPricesWithChange(): Promise<Record<string, PriceData>> {
  // Check if cache is still valid
  const now = Date.now();
  if (priceCache.timestamp > 0 && (now - priceCache.timestamp) < PRICE_CACHE_DURATION) {
    return priceCache.data;
  }
  
  // Try to fetch from CoinGecko first
  const coinGeckoPrices = await fetchCoinGeckoPrices();
  
  // If successful, use CoinGecko data
  if (coinGeckoPrices && Object.keys(coinGeckoPrices).length > 0) {
    priceCache = {
      timestamp: now,
      data: coinGeckoPrices
    };
    
    // Save prices to database for historical records
    try {
      await savePricesToDatabase(coinGeckoPrices);
    } catch (err) {
      console.error('Error saving prices to database:', err);
    }
    
    return coinGeckoPrices;
  }
  
  // Fall back to simulated data
  const simulatedPrices = generateSimulatedPrices();
  
  priceCache = {
    timestamp: now,
    data: simulatedPrices
  };
  
  // Save simulated prices to database for historical records
  try {
    await savePricesToDatabase(simulatedPrices);
  } catch (err) {
    console.error('Error saving simulated prices to database:', err);
  }
  
  return simulatedPrices;
}

/**
 * Get price for a specific asset
 */
export async function getPriceForAsset(assetSymbol: string): Promise<PriceData | null> {
  const prices = await getPricesWithChange();
  return prices[assetSymbol] || null;
}

/**
 * Save prices to database for historical reference
 */
async function savePricesToDatabase(prices: Record<string, PriceData>): Promise<void> {
  const assets = await storage.getAllAssets();
  
  for (const asset of assets) {
    const price = prices[asset.symbol];
    
    if (price) {
      const priceFeed: InsertPriceFeed = {
        assetId: asset.id,
        price: price.current.toString(), // Convert to string for database
        timestamp: new Date(),
      };
      
      await storage.createPriceFeed(priceFeed);
    }
  }
}