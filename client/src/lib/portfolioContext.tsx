import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePriceDetails } from './usePriceDetails';
import { useWallet } from './walletContext';

// Define the portfolio asset data structure
export interface PortfolioAsset {
  id: number;
  name: string;
  symbol: string;
  type: string;
  amount: number;
}

export interface AssetWithAllocation {
  asset: PortfolioAsset;
  amount: number;
  valueUSD: number;
  percentOfPortfolio: number;
  price: number;
}

interface PortfolioContextType {
  portfolioValue: number;
  previousValue: number;
  percentChange: number;
  assetAllocations: AssetWithAllocation[];
  priceDetails: Record<string, { current: number; previous24h: number; change24h: number; changePercentage24h: number }>;
  isLoading: boolean;
}

// Create the context with default values
const PortfolioContext = createContext<PortfolioContextType>({
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
  
  // Fetch price information with 24h history
  const { priceDetails, loading: pricesLoading } = usePriceDetails(30000);
  
  // Get vault allocations to calculate portfolio values (from API)
  const { data: vaults = [], isLoading: isLoadingVaults } = useQuery<any[]>({
    queryKey: ['/api/vaults'],
    enabled: isConnected
  });
  
  // Get assets to map symbols to names (from API)
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<any[]>({
    queryKey: ['/api/assets']
  });
  
  // Prepare asset allocations for all vaults (from API)
  // Get the first vault ID as the active vault
  const activeVaultId = vaults.length > 0 ? vaults[0]?.id : null;
  
  const { data: allocationsData = [], isLoading: isLoadingAllocations } = useQuery<any[]>({
    queryKey: ['/api/vaults', activeVaultId, 'allocations'],
    enabled: !!activeVaultId && isConnected
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [previousValue, setPreviousValue] = useState(0);
  const [percentChange, setPercentChange] = useState(0);
  const [assetAllocations, setAssetAllocations] = useState<AssetWithAllocation[]>([]);
  
  // Calculate portfolio values when all data is available
  useEffect(() => {
    // Combine loading states into a single state to reduce re-renders
    const dataLoading = pricesLoading || isLoadingVaults || isLoadingAssets || isLoadingAllocations;
    
    // If data is still loading or we're not connected, don't proceed
    if (!isConnected || dataLoading || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    // Check if we have valid API data
    const hasApiData = allocationsData.length > 0 && assets.length > 0;
    
    // Check if we have vaults but no allocations - this means a new user with no portfolio
    const isNewUser = vaults.length === 0 || (vaults.length > 0 && allocationsData.length === 0);
    
    // Create a calculation function to avoid issues with setState in useEffect
    const calculatePortfolio = () => {
      let totalValue = 0;
      let totalPreviousValue = 0;
      const allocations: AssetWithAllocation[] = [];
      
      // For new users, return empty portfolio with $0.00 value
      if (isNewUser) {
        console.log("New user detected - showing empty portfolio");
        return {
          allocations: [],
          totalValue: 0,
          totalPreviousValue: 0,
          change: 0
        };
      }
      
      if (hasApiData) {
        // Use real data from API
        for (const allocation of allocationsData) {
          const asset = assets.find((a: any) => a.id === allocation.assetId);
          if (asset && priceDetails[asset.symbol]) {
            const currentPrice = priceDetails[asset.symbol].current;
            const previousPrice = priceDetails[asset.symbol].previous24h;
            
            // Get allocation amount (in a real app, this would be the actual token amount)
            const amount = allocation.amount || parseFloat(allocation.targetPercentage);
            
            const value = amount * currentPrice;
            const previousValue = amount * previousPrice;
            
            totalValue += value;
            totalPreviousValue += previousValue;
            
            // Store allocation data
            allocations.push({
              asset: {
                id: asset.id,
                name: asset.name,
                symbol: asset.symbol,
                type: asset.type,
                amount
              },
              amount,
              valueUSD: value,
              price: currentPrice,
              percentOfPortfolio: 0, // Temporary value, will be calculated after totalValue is known
            });
          }
        }
      } else if (!isNewUser) {
        // If we have a wallet connection but no API data, show empty portfolio
        // This ensures we only display real authenticated data
        console.log("Connected wallet with no portfolio data - showing empty portfolio");
        return {
          allocations: [],
          totalValue: 0,
          totalPreviousValue: 0,
          change: 0
        };
      }
      
      // If we don't have previous values and have real data
      if (totalPreviousValue === 0 && totalValue > 0 && hasApiData) {
        // Use same value as current (0% change)
        totalPreviousValue = totalValue;
      }
      
      // Only continue with updates if we have actual data
      if (allocations.length > 0 && totalValue > 0) {
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
        
        return {
          allocations,
          totalValue,
          totalPreviousValue,
          change
        };
      }
      
      return null;
    };
    
    try {
      // Only change loading state if we're not already loading
      if (!isLoading) {
        setIsLoading(true);
      }
      
      // Calculate portfolio values
      const result = calculatePortfolio();
      
      if (result) {
        // Use a single batch update to reduce render cycles
        setAssetAllocations(result.allocations);
        setPortfolioValue(result.totalValue);
        setPreviousValue(result.totalPreviousValue);
        setPercentChange(result.change);
      }
    } catch (error) {
      console.error("Error calculating portfolio values:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    isConnected, 
    // Use a string representation of price details to avoid unnecessary recalculations
    JSON.stringify(priceDetails), 
    // Include loading states
    pricesLoading, 
    isLoadingVaults, 
    isLoadingAssets, 
    isLoadingAllocations,
    // Include data dependencies as string representations to reduce render cycles
    JSON.stringify(vaults), 
    JSON.stringify(assets), 
    JSON.stringify(allocationsData),
    // Include current state values to prevent unnecessary updates
    isLoading
  ]);
  
  // Context value that will be provided to consumers
  const value = {
    portfolioValue,
    previousValue,
    percentChange,
    assetAllocations,
    priceDetails,
    isLoading: isLoading || pricesLoading || isLoadingVaults || isLoadingAssets || isLoadingAllocations
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