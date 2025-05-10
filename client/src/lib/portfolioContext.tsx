import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePriceDetails } from './usePriceDetails';
import { useWallet } from './walletContext';

// Define the mock portfolio data structure
export interface MockAsset {
  id: number;
  name: string;
  symbol: string;
  type: string;
  amount: number;
}

export interface AssetWithAllocation {
  asset: MockAsset;
  amount: number;
  valueUSD: number;
  percentOfPortfolio: number;
  price: number;
}

interface PortfolioContextType {
  mockPortfolio: MockAsset[];
  portfolioValue: number;
  previousValue: number;
  percentChange: number;
  assetAllocations: AssetWithAllocation[];
  priceDetails: Record<string, { current: number; previous24h: number }>;
  isLoading: boolean;
}

// Create the context with default values
const PortfolioContext = createContext<PortfolioContextType>({
  mockPortfolio: [],
  portfolioValue: 0,
  previousValue: 0,
  percentChange: 0,
  assetAllocations: [],
  priceDetails: {},
  isLoading: true,
});

// Provider component that wraps the app
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet();
  const { priceDetails, loading: pricesLoading } = usePriceDetails(30000);
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [previousValue, setPreviousValue] = useState(0);
  const [percentChange, setPercentChange] = useState(0);
  const [assetAllocations, setAssetAllocations] = useState<AssetWithAllocation[]>([]);
  
  // Define a consistent mock portfolio that all components will use
  const mockPortfolio: MockAsset[] = [
    { id: 1, name: "Bitcoin", symbol: "BTC", type: "crypto", amount: 0.5 },
    { id: 2, name: "Ethereum", symbol: "ETH", type: "crypto", amount: 5.0 },
    { id: 3, name: "Layer One X", symbol: "L1X", type: "crypto", amount: 500.0 },
    { id: 4, name: "Solana", symbol: "SOL", type: "crypto", amount: 15.0 },
    { id: 5, name: "USD Coin", symbol: "USDC", type: "stablecoin", amount: 1000.0 }
  ];
  
  // Calculate portfolio values when price data changes
  useEffect(() => {
    if (!isConnected || pricesLoading || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    // Calculate current total value
    let totalValue = 0;
    let totalPreviousValue = 0;
    const allocations: AssetWithAllocation[] = [];
    
    mockPortfolio.forEach(asset => {
      if (priceDetails[asset.symbol]) {
        // Calculate current value
        const price = priceDetails[asset.symbol].current;
        const assetValue = asset.amount * price;
        totalValue += assetValue;
        
        // Calculate previous value (24h ago)
        const assetPrevValue = asset.amount * priceDetails[asset.symbol].previous24h;
        totalPreviousValue += assetPrevValue;
        
        // Store allocation data
        allocations.push({
          asset: asset,
          amount: asset.amount,
          valueUSD: assetValue,
          price: price,
          percentOfPortfolio: 0, // Temporary value, will be calculated after totalValue is known
        });
      }
    });
    
    // If we don't have previous values, simulate one
    if (totalPreviousValue === 0) {
      totalPreviousValue = totalValue * 0.95; // Simulate 5% growth by default
    }
    
    // Calculate percent change
    const change = totalPreviousValue > 0 
      ? ((totalValue - totalPreviousValue) / totalPreviousValue) * 100 
      : 0;
    
    // Update the percentages now that we know the total value
    allocations.forEach(allocation => {
      allocation.percentOfPortfolio = (allocation.valueUSD / totalValue) * 100;
    });
    
    // Sort allocations by value
    allocations.sort((a, b) => b.valueUSD - a.valueUSD);
    
    setAssetAllocations(allocations);
    setPortfolioValue(totalValue);
    setPreviousValue(totalPreviousValue);
    setPercentChange(change);
    setIsLoading(false);
  }, [isConnected, priceDetails, pricesLoading]);
  
  // Context value that will be provided to consumers
  const value = {
    mockPortfolio,
    portfolioValue,
    previousValue,
    percentChange,
    assetAllocations,
    priceDetails,
    isLoading: isLoading || pricesLoading
  };
  
  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

// Custom hook to use the portfolio context
export function usePortfolio() {
  return useContext(PortfolioContext);
}