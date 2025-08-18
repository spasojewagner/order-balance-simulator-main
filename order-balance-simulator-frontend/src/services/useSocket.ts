// hooks/useSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface PriceUpdate {
    price: number;
    timestamp: number;
}

interface UseSocketReturn {
    socket: Socket | null;
    isConnected: boolean;
    realtimePrice: number | null;
    priceHistory: PriceUpdate[];
    subscribe: (coinId: string) => void;
    unsubscribe: (coinId: string) => void;
}

let socketInstance: Socket | null = null;

export const useSocket = (coinId?: string): UseSocketReturn => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceUpdate[]>([]);
    
    // Initialize socket connection
    useEffect(() => {
        if (!socketInstance) {
            const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
            
            console.log('🔌 Initializing Socket.IO connection to:', serverUrl);
            
            socketInstance = io(serverUrl, {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });
            
            socketInstance.on('connect', () => {
                console.log('✅ Socket connected with ID:', socketInstance?.id);
                setIsConnected(true);
            });
            
            socketInstance.on('disconnect', (reason) => {
                console.log('❌ Socket disconnected:', reason);
                setIsConnected(false);
            });
            
            socketInstance.on('connect_error', (error) => {
                console.error('🔴 Socket connection error:', error.message);
            });
            
            socketInstance.on('reconnect', (attemptNumber) => {
                console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
                setIsConnected(true);
            });
        }
        
        setSocket(socketInstance);
        
        // Cleanup on unmount
        return () => {
            // Don't disconnect the socket here as it's shared
            // Only disconnect when the entire app unmounts
        };
    }, []);
    
    // Subscribe to coin price updates
    useEffect(() => {
        if (!socket || !coinId) return;
        
        console.log(`📊 Subscribing to price updates for: ${coinId}`);
        socket.emit('subscribe', coinId);
        
        const priceUpdateEvent = `price_update_${coinId}`;
        
        const handlePriceUpdate = (data: PriceUpdate) => {
            console.log(`💰 Price update for ${coinId}:`, data);
            setRealtimePrice(data.price);
            
            // Keep last 100 price updates in history
            setPriceHistory(prev => {
                const newHistory = [...prev, data];
                return newHistory.slice(-100);
            });
        };
        
        socket.on(priceUpdateEvent, handlePriceUpdate);
        
        // Cleanup
        return () => {
            if (socket) {
                console.log(`🔚 Unsubscribing from ${coinId}`);
                socket.emit('unsubscribe', coinId);
                socket.off(priceUpdateEvent, handlePriceUpdate);
            }
        };
    }, [socket, coinId]);
    
    // Manual subscribe/unsubscribe functions
    const subscribe = useCallback((newCoinId: string) => {
        if (socket) {
            console.log(`📈 Manual subscribe to: ${newCoinId}`);
            socket.emit('subscribe', newCoinId);
        }
    }, [socket]);
    
    const unsubscribe = useCallback((oldCoinId: string) => {
        if (socket) {
            console.log(`📉 Manual unsubscribe from: ${oldCoinId}`);
            socket.emit('unsubscribe', oldCoinId);
        }
    }, [socket]);
    
    return {
        socket,
        isConnected,
        realtimePrice,
        priceHistory,
        subscribe,
        unsubscribe,
    };
};

// Export singleton socket instance for global access
export const getSocketInstance = (): Socket | null => socketInstance;

// Disconnect socket (call this when app unmounts)
export const disconnectSocket = () => {
    if (socketInstance) {
        console.log('🔌 Disconnecting socket...');
        socketInstance.disconnect();
        socketInstance = null;
    }
};