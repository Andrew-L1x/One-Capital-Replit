import { apiRequest } from "./queryClient";

// Types
export interface AssetPrice {
  symbol: string;
  price: number;
}

export interface VaultValue {
  vaultId: number;
  vaultValue: number;
  assetValues: AssetValue[];
  timestamp: string;
}

export interface AssetValue {
  assetId: number;
  symbol: string;
  tokenAmount: number;
  price: number;
  value: number;
}

/**
 * Fetch real-time prices for all assets
 */
export async function fetchAllPrices(): Promise<Record<string, number>> {
  try {
    const response = await apiRequest({
      url: '/prices',
      method: 'GET',
    });
    return response as Record<string, number>;
  } catch (error) {
    console.error('Error fetching asset prices:', error);
    return {};
  }
}

/**
 * Fetch price for a specific asset by symbol
 */
export async function fetchAssetPrice(symbol: string): Promise<number | null> {
  try {
    const response = await apiRequest({
      url: `/prices/${symbol}`,
      method: 'GET',
    });
    return (response as { symbol: string; price: number }).price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch value for a specific vault including all asset values
 */
export async function fetchVaultValue(vaultId: number): Promise<VaultValue | null> {
  try {
    const response = await apiRequest({
      url: `/vaults/${vaultId}/value`,
      method: 'GET',
    });
    return response as VaultValue;
  } catch (error) {
    console.error(`Error fetching value for vault ${vaultId}:`, error);
    return null;
  }
}

/**
 * Format price as USD currency string
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format large number with appropriate suffix (K, M, B)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  } else {
    return value.toFixed(2);
  }
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change with + or - sign
 */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}