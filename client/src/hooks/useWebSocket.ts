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

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Clear any pending reconnect timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
      
      // Subscribe to channels
      const subscriptionMessage = {
        type: 'subscribe',
        channels,
        ...(vaultId ? { vaultId } : {})
      };
      
      socket.send(JSON.stringify(subscriptionMessage));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        setMessages((prev) => [...prev, message].slice(-50)); // Keep last 50 messages
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected, scheduling reconnect...');
      setConnected(false);
      
      // Schedule reconnect after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          console.log('Attempting to reconnect WebSocket...');
          connectWebSocket();
        }
      }, 3000);
    };
  }, [channels, vaultId]);

  // Send message to the WebSocket server
  const sendMessage = useCallback((type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }, []);

  // Connect on component mount and reconnect when visibility changes
  useEffect(() => {
    connectWebSocket();
    
    // Reconnect when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
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

  // Reconnect if channels or vaultId change
  useEffect(() => {
    if (connected) {
      connectWebSocket();
    }
  }, [channels, vaultId, connectWebSocket]);

  return {
    connected,
    sendMessage,
    lastMessage,
    messages,
  };
}