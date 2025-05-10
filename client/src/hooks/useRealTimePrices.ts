import { useState, useEffect } from 'react';
import useWebSocket from './useWebSocket';
import { PriceMap, PriceData, getPrices } from '../lib/priceService';

/**
 * Custom hook for real-time price updates
 * 
 * @returns Live price data with loading states
 */
export default function useRealTimePrices() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { connected, lastMessage } = useWebSocket(['prices']);

  // Initial price fetch from API
  useEffect(() => {
    const fetchInitialPrices = async () => {
      try {
        setLoading(true);
        const priceData = await getPrices();
        setPrices(priceData);
        console.log('Fetched price details:', priceData);
      } catch (err) {
        console.error('Error fetching prices:', err);
        setError(err instanceof Error ? err : new Error('Unknown error fetching prices'));
      } finally {
        setLoading(false);
      }
    };

    fetchInitialPrices();

    // Set up interval for regular updates if WebSocket isn't available
    const intervalId = setInterval(() => {
      if (!connected) {
        fetchInitialPrices();
      }
    }, 60000); // Update every minute if WebSocket is disconnected

    return () => clearInterval(intervalId);
  }, [connected]);

  // Handle price updates from WebSocket
  useEffect(() => {
    if (lastMessage?.channel === 'prices' && lastMessage?.type === 'update') {
      // Update entire price map
      if (lastMessage.data?.prices && typeof lastMessage.data.prices === 'object') {
        setPrices(lastMessage.data.prices);
      }
      // Update single price
      else if (lastMessage.data?.symbol && lastMessage.data?.price) {
        setPrices(prev => ({
          ...prev,
          [lastMessage.data.symbol]: {
            ...prev[lastMessage.data.symbol],
            current: lastMessage.data.price.current,
            previous24h: lastMessage.data.price.previous24h || prev[lastMessage.data.symbol]?.previous24h || 0,
            change24h: lastMessage.data.price.change24h || 
              (lastMessage.data.price.current - (prev[lastMessage.data.symbol]?.previous24h || 0)),
            changePercentage24h: lastMessage.data.price.changePercentage24h || 
              ((lastMessage.data.price.current - (prev[lastMessage.data.symbol]?.previous24h || 0)) / 
              (prev[lastMessage.data.symbol]?.previous24h || 1) * 100)
          }
        }));
      }
    }
  }, [lastMessage]);

  return {
    prices,
    loading,
    error,
    connected
  };
}