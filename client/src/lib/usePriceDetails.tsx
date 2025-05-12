import { useState, useEffect, useRef } from 'react';
import { apiRequest } from './queryClient';
import { useWallet } from './walletContext';
import { usePortfolio } from './portfolioContext';
import { useQuery } from '@tanstack/react-query';

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
 * Custom hook to get digital asset price details including historical data
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
  const webSocketRef = useRef<WebSocket | null>(null);
  const { isConnected } = useWallet();
  
  // Fetch initial price data from REST API
  const fetchPriceDetailsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Direct API request to ensure fresh data
      const data = await apiRequest('/api/prices');
      
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
  
  // Set up WebSocket connection for real-time price updates
  useEffect(() => {
    // Initial fetch
    fetchPriceDetailsData();
    
    // Connect to the WebSocket for real-time updates
    const connectWebSocket = () => {
      try {
        // Close any existing connection
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
        
        // Set up the WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const socket = new WebSocket(wsUrl);
        webSocketRef.current = socket;
        
        socket.onopen = () => {
          console.log('WebSocket connected for price updates');
          
          // Subscribe to price updates
          socket.send(JSON.stringify({
            type: 'subscribe',
            channel: 'prices'
          }));
          
          // Send a ping every 30 seconds to keep the connection alive
          const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
          
          // Clear the ping interval when the socket closes
          socket.onclose = () => {
            clearInterval(pingInterval);
            console.log('WebSocket disconnected');
            
            // Try to reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
          };
        };
        
        // Handle incoming messages
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle price updates
            if (message.channel === 'prices' && message.data && message.data.prices) {
              const newPrices: PriceDetailMap = message.data.prices;
              
              setPriceDetails((currentPrices) => {
                // Only update if we have new data
                if (Object.keys(newPrices).length > 0) {
                  return { ...currentPrices, ...newPrices };
                }
                return currentPrices;
              });
            }
            
            // Handle pong responses (keep-alive)
            if (message.type === 'pong') {
              console.debug('Received pong from server');
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err);
          }
        };
        
        // Handle errors
        socket.onerror = (err) => {
          console.error('WebSocket error:', err);
          socket.close();
        };
      } catch (err) {
        console.error('Error setting up WebSocket connection:', err);
      }
    };
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Set up fallback interval for regular price updates in case WebSocket fails
    const intervalId = setInterval(fetchPriceDetailsData, refreshInterval);
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
    };
  }, [refreshInterval, isConnected]);
  
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

/**
 * Custom hook to fetch historical portfolio performance data
 */
export function useHistoricalPerformance(timeRange: string = '30d') {
  const { isConnected } = useWallet();
  
  // Fetch historical price data from API
  const { 
    data: historicalData = [], 
    isLoading, 
    error,
    refetch
  } = useQuery<any[]>({
    queryKey: [`/api/prices/history/${timeRange}`],
    enabled: isConnected,
    refetchInterval: 60000, // Refresh every minute
  });
  
  return {
    historicalData,
    isLoading,
    error,
    refetch
  };
}