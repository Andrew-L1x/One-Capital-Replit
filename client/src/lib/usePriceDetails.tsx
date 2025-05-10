import { useState, useEffect } from 'react';
import { apiRequest } from './queryClient';

interface PriceDetail {
  current: number;
  previous24h: number;
  change24h: number;
  changePercentage24h: number;
}

interface PriceDetailMap {
  [symbol: string]: PriceDetail;
}

/**
 * Custom hook to get cryptocurrency price details including historical data
 */
export function usePriceDetails(refreshInterval = 30000): {
  priceDetails: PriceDetailMap;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [priceDetails, setPriceDetails] = useState<PriceDetailMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchPriceDetailsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Direct API request to ensure fresh data
      const response = await apiRequest('GET', '/api/prices');
      const data = await response.json();
      
      console.log("Fetched price details:", data);
      
      // Ensure we've received actual data before proceeding
      if (Object.keys(data).length === 0) {
        console.error("No price data available from API. Please check the price feed connection.");
        throw new Error("No price data received from API");
      }
      
      // Update the price detail cache
      const newPriceDetailCache: PriceDetailMap = {};
      Object.entries(data).forEach(([symbol, detail]: [string, any]) => {
        if (detail && typeof detail === 'object' && 'current' in detail) {
          newPriceDetailCache[symbol] = detail as PriceDetail;
        }
      });
      
      setPriceDetails(newPriceDetailCache);
    } catch (err) {
      console.error('Error in usePriceDetails hook:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching price details'));
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch prices on mount
  useEffect(() => {
    fetchPriceDetailsData();
    
    // Set up interval for regular price updates
    const intervalId = setInterval(fetchPriceDetailsData, refreshInterval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval]);
  
  return { priceDetails, loading, error, refetch: fetchPriceDetailsData };
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

/**
 * Format percentage for display
 */
export function formatPercentage(percentage: number): string {
  return `${percentage >= 0 ? '+' : ''}${Math.round(percentage)}%`;
}