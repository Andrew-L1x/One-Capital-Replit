import axios from 'axios';
import { storage } from '../storage';
import { InsertPriceFeed } from '@shared/schema';

// Price cache to minimize API calls
interface PriceCache {
  [symbol: string]: {
    price: number;
    lastUpdated: number;
  }
}

// Cache expiration time in milliseconds (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

// Price cache
const priceCache: PriceCache = {};

// Get price from CoinGecko API
async function fetchPriceFromCoinGecko(symbol: string): Promise<number | null> {
  try {
    // CoinGecko requires the symbol to be lowercase
    const coinId = getCoinGeckoId(symbol.toLowerCase());
    if (!coinId) {
      console.warn(`No CoinGecko ID mapping for symbol: ${symbol}`);
      return null;
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (response.data && response.data[coinId] && response.data[coinId].usd) {
      return response.data[coinId].usd;
    }

    console.warn(`No price data found for ${symbol} (${coinId})`);
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

// Map token symbols to CoinGecko IDs
function getCoinGeckoId(symbol: string): string | null {
  const mappings: Record<string, string> = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'sol': 'solana',
    'ada': 'cardano',
    'dot': 'polkadot',
    'avax': 'avalanche-2',
    'matic': 'matic-network',
    'link': 'chainlink',
    'uni': 'uniswap',
    'aave': 'aave',
    'l1x': 'layer-one-x', // assuming this is the correct ID, adjust as needed
    'usdt': 'tether',
    'usdc': 'usd-coin',
    'dai': 'dai',
  };

  return mappings[symbol] || null;
}

// Get price from cache or API
export async function getPrice(symbol: string): Promise<number | null> {
  const normalizedSymbol = symbol.toLowerCase();
  
  // Check cache first
  if (
    priceCache[normalizedSymbol] &&
    Date.now() - priceCache[normalizedSymbol].lastUpdated < CACHE_EXPIRATION
  ) {
    return priceCache[normalizedSymbol].price;
  }

  // Fetch fresh price from API
  const price = await fetchPriceFromCoinGecko(normalizedSymbol);
  
  // Update cache if price was found
  if (price !== null) {
    priceCache[normalizedSymbol] = {
      price,
      lastUpdated: Date.now()
    };
    
    // Store price in database for historical reference
    try {
      const asset = await storage.getAssetBySymbol(normalizedSymbol);
      if (asset) {
        const priceFeed: InsertPriceFeed = {
          assetId: asset.id,
          price,
          timestamp: new Date()
        };
        await storage.createPriceFeed(priceFeed);
      }
    } catch (error) {
      console.error(`Error storing price for ${normalizedSymbol}:`, error);
    }
  }

  return price;
}

// Get prices for multiple symbols
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  await Promise.all(
    symbols.map(async (symbol) => {
      const price = await getPrice(symbol);
      if (price !== null) {
        prices[symbol] = price;
      }
    })
  );
  
  return prices;
}

// Get prices for all assets in the database
export async function getAllAssetPrices(): Promise<Record<string, number>> {
  try {
    const assets = await storage.getAllAssets();
    const symbols = assets.map(asset => asset.symbol);
    return await getPrices(symbols);
  } catch (error) {
    console.error('Error fetching all asset prices:', error);
    return {};
  }
}

// Update on-chain prices (to be implemented with contract integration)
export async function updateOnChainPrices(): Promise<void> {
  // This will be implemented in the next phase with contract integration
  console.log('Updating on-chain prices...');
  
  try {
    const prices = await getAllAssetPrices();
    
    // For each price, call the smart contract to update
    // This is a placeholder that will be implemented with actual contract calls
    for (const [symbol, price] of Object.entries(prices)) {
      console.log(`Updating on-chain price for ${symbol}: $${price}`);
      // TODO: Call smart contract to update price
      // await updateContractPrice(symbol, price);
    }
  } catch (error) {
    console.error('Error updating on-chain prices:', error);
  }
}

// Schedule periodic price updates
export function schedulePriceUpdates(intervalMinutes = 10): NodeJS.Timer {
  console.log(`Scheduling price updates every ${intervalMinutes} minutes`);
  return setInterval(async () => {
    try {
      await updateOnChainPrices();
    } catch (error) {
      console.error('Error in scheduled price update:', error);
    }
  }, intervalMinutes * 60 * 1000);
}