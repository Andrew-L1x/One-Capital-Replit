import { apiRequest } from './queryClient';

export type PriceData = {
  current: number;
  previous24h: number;
  change24h: number;
  changePercentage24h: number;
};

export type PriceMap = Record<string, PriceData>;

/**
 * Fetch price data for all supported assets
 * @returns Map of symbols to price data
 */
export async function getPrices(): Promise<PriceMap> {
  try {
    const response = await apiRequest('/api/prices');
    return response || {};
  } catch (error) {
    console.error('Error fetching prices:', error);
    return {};
  }
}

/**
 * Fetch price data for a specific symbol
 * @param symbol Asset symbol (e.g. "BTC")
 * @returns Price data or undefined if not available
 */
export async function getPriceBySymbol(symbol: string): Promise<PriceData | undefined> {
  try {
    const response = await apiRequest(`/api/prices/${symbol}`);
    return response;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return undefined;
  }
}

/**
 * Calculate portfolio value based on current prices
 * @param holdings Map of asset symbols to amounts
 * @returns Total value in USD
 */
export async function calculatePortfolioValue(holdings: Record<string, number>): Promise<number> {
  try {
    const prices = await getPrices();
    let totalValue = 0;
    
    Object.entries(holdings).forEach(([symbol, amount]) => {
      if (prices[symbol] && prices[symbol].current) {
        totalValue += prices[symbol].current * amount;
      }
    });
    
    return totalValue;
  } catch (error) {
    console.error('Error calculating portfolio value:', error);
    return 0;
  }
}

/**
 * Format price with appropriate decimal places
 * @param price Price value
 * @param decimals Number of decimal places
 * @returns Formatted price string
 */
export function formatPrice(price: number | undefined, decimals = 2): string {
  if (price === undefined) return '$0.00';
  
  // Handle different ranges of values
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  } else if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 0.01) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  } else {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
  }
}

/**
 * Format percentage with appropriate sign and decimals
 * @param percentage Percentage value
 * @returns Formatted percentage string
 */
export function formatPercentage(percentage: number | undefined): string {
  if (percentage === undefined) return '0.00%';
  
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

/**
 * Get color based on price change percentage
 * @param changePercentage Change percentage
 * @returns CSS color class
 */
export function getPriceChangeColor(changePercentage: number | undefined): string {
  if (changePercentage === undefined) return 'text-gray-500';
  if (changePercentage > 0) return 'text-green-600';
  if (changePercentage < 0) return 'text-red-600';
  return 'text-gray-500';
}