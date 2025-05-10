import { useEffect, useState } from 'react';
import { apiRequest } from './queryClient';

// Define types for price data
export interface AssetPrice {
  symbol: string;
  price: number;
  lastUpdated: Date;
}

interface PriceMap {
  [symbol: string]: number;
}

// Cache for prices
let priceCache: PriceMap = {};
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Fetch all prices from the API
 */
export async function fetchAllPrices(): Promise<PriceMap> {
  try {
    const now = Date.now();
    
    // Use cache if it's still fresh
    if (now - lastFetchTime < CACHE_DURATION && Object.keys(priceCache).length > 0) {
      return priceCache;
    }
    
    // Fetch from API
    const response = await apiRequest('GET', '/api/prices');
    const prices = await response.json();
    
    // Update cache
    if (prices && typeof prices === 'object') {
      priceCache = prices as PriceMap;
      lastFetchTime = now;
      return priceCache;
    }
    
    return {};
  } catch (error) {
    console.error('Error fetching prices:', error);
    return {};
  }
}

/**
 * Fetch price for a specific asset by symbol
 */
export async function fetchPriceBySymbol(symbol: string): Promise<number | null> {
  try {
    // Check cache first
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && priceCache[symbol]) {
      return priceCache[symbol];
    }
    
    // Fetch from API
    const response = await apiRequest('GET', `/api/prices/${symbol}`);
    const priceData = await response.json();
    const price = priceData ? Number(priceData) : null;
    
    // Update cache for this symbol
    if (price !== null && !isNaN(price)) {
      priceCache[symbol] = price;
      lastFetchTime = now;
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Custom hook to subscribe to price updates
 */
export function usePrices(symbols: string[] = [], refreshInterval = 30000): {
  prices: PriceMap;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchPrices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (symbols.length === 0) {
        // Fetch all prices
        const allPrices = await fetchAllPrices();
        setPrices(allPrices);
      } else {
        // Fetch specific symbols
        const priceMap: PriceMap = {};
        
        // Use existing cache where possible
        const uncachedSymbols = symbols.filter(
          symbol => !priceCache[symbol] || Date.now() - lastFetchTime > CACHE_DURATION
        );
        
        // Add cached prices to the result
        symbols.forEach(symbol => {
          if (priceCache[symbol] && Date.now() - lastFetchTime <= CACHE_DURATION) {
            priceMap[symbol] = priceCache[symbol];
          }
        });
        
        // Fetch uncached symbols
        if (uncachedSymbols.length > 0) {
          const promises = uncachedSymbols.map(symbol => fetchPriceBySymbol(symbol));
          const results = await Promise.all(promises);
          
          // Add fetched prices to the result
          uncachedSymbols.forEach((symbol, index) => {
            const price = results[index];
            if (price !== null) {
              priceMap[symbol] = price;
            }
          });
        }
        
        setPrices(priceMap);
      }
    } catch (err) {
      console.error('Error in usePrices hook:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching prices'));
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch prices on mount and when symbols change
  useEffect(() => {
    fetchPrices();
    
    // Set up interval for regular price updates
    const intervalId = setInterval(fetchPrices, refreshInterval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [JSON.stringify(symbols), refreshInterval]);
  
  return { prices, loading, error, refetch: fetchPrices };
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '$0.00';
  
  // Format with appropriate precision
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  }
}