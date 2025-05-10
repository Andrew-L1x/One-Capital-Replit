import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  channel: string;
  data?: any;
  timestamp?: string;
}

/**
 * Custom hook for WebSocket connection
 * 
 * @param channels Optional array of channels to subscribe to
 * @param vaultId Optional vault ID to subscribe to vault-specific updates
 * @returns WebSocket connection state and message handling utilities
 */
export default function useWebSocket(channels: string[] = ['prices'], vaultId?: number) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 5000; // 5 seconds between reconnects
  const BACKOFF_MULTIPLIER = 1.5; // Exponential backoff multiplier

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Don't reconnect if we've reached the maximum attempts - will try again when user takes action
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping automatic reconnection.`);
      return;
    }

    // Close existing connection if any
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }

    // Clear any pending reconnect timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      // Create new WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      // WebSocket event handlers
      socket.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        
        // Subscribe to channels
        try {
          const subscriptionMessage = {
            type: 'subscribe',
            channels,
            ...(vaultId ? { vaultId } : {})
          };
          
          socket.send(JSON.stringify(subscriptionMessage));
        } catch (err) {
          console.error('Error sending subscription message:', err);
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
          setMessages((prev) => [...prev, message].slice(-20)); // Keep last 20 messages
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
        // Don't trigger reconnect here, let onclose handle it
      };

      socket.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
        setConnected(false);
        
        if (event.code === 1000) {
          // Normal closure, don't reconnect
          console.log('WebSocket closed normally');
          return;
        }
        
        // Use exponential backoff for reconnection
        const backoffTime = RECONNECT_INTERVAL * Math.pow(BACKOFF_MULTIPLIER, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        
        console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${backoffTime}ms`);
        
        // Schedule reconnect after calculated delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current})`);
            connectWebSocket();
          }
        }, backoffTime);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      
      // Schedule reconnect after a delay
      const backoffTime = RECONNECT_INTERVAL * Math.pow(BACKOFF_MULTIPLIER, reconnectAttemptsRef.current);
      reconnectAttemptsRef.current++;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          connectWebSocket();
        }
      }, backoffTime);
    }
  }, [channels, vaultId]);

  // Send message to the WebSocket server
  const sendMessage = useCallback((type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type, ...data }));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Manual reconnect function that users can call
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0; // Reset attempts counter
    connectWebSocket();
  }, [connectWebSocket]);

  // Connect on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Reconnect when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
        reconnectAttemptsRef.current = 0; // Reset attempts counter on visibility change
        console.log('Page visible, reconnecting WebSocket...');
        connectWebSocket();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Don't reconnect if channels or vaultId change - too aggressive
  // We'll just update the subscription on the next message

  return {
    connected,
    sendMessage,
    lastMessage,
    messages,
    reconnect
  };
}