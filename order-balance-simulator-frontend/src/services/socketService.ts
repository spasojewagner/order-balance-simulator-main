import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { updateOrderRealTime, removeOrderRealTime } from '../store/slices/orderSlice';
import { toast } from 'react-toastify';

class SocketService {
  public socket: Socket | null = null;
  private subscribedPairs: Set<string> = new Set();
  
  connect() {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    
    this.socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
    
    // Listen for order updates
    this.socket.on('order_update', (data: any) => {
      console.log('📊 Order update received:', data);
      if (data.orderId) {
        store.dispatch(updateOrderRealTime(data));
      }
    });
    
    // Listen for trades and other events
    this.socket.onAny((eventName, data) => {
      if (eventName.startsWith('trade_')) {
        console.log('💹 Trade executed:', data);
        toast.info(`Trade executed: ${data.amount} @ ${data.price}`, {
          position: "bottom-right",
          autoClose: 3000
        });
      }
      
      if (eventName.startsWith('orderbook_')) {
        console.log('📚 Order book updated:', data);
        // You can dispatch an action to update order book in Redux if needed
      }
      
      if (eventName.startsWith('market_data_')) {
        console.log('📈 Market data updated:', data);
        // You can dispatch an action to update market data in Redux if needed
      }
      
      if (eventName.startsWith('price_update_')) {
        console.log('💰 Price update:', data);
        // You can dispatch an action to update price in Redux if needed
      }
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  subscribeToOrderBook(pair: string) {
    if (this.socket && !this.subscribedPairs.has(pair)) {
      this.socket.emit('subscribe_orderbook', pair);
      this.subscribedPairs.add(pair);
      console.log('📊 Subscribed to order book:', pair);
    }
  }
  
  unsubscribeFromOrderBook(pair: string) {
    if (this.socket && this.subscribedPairs.has(pair)) {
      this.socket.emit('unsubscribe_orderbook', pair);
      this.subscribedPairs.delete(pair);
      console.log('📊 Unsubscribed from order book:', pair);
    }
  }
  
  subscribeToPriceUpdates(coinId: string) {
    if (this.socket) {
      this.socket.emit('subscribe', coinId);
      console.log('💰 Subscribed to price updates:', coinId);
    }
  }
  
  unsubscribeFromPriceUpdates(coinId: string) {
    if (this.socket) {
      this.socket.emit('unsubscribe', coinId);
      console.log('💰 Unsubscribed from price updates:', coinId);
    }
  }
  
  subscribeToTrades(pair: string) {
    if (this.socket) {
      this.socket.emit('subscribe_trades', pair);
      console.log('📈 Subscribed to trades:', pair);
    }
  }
  
  unsubscribeFromTrades(pair: string) {
    if (this.socket) {
      this.socket.emit('unsubscribe_trades', pair);
      console.log('📈 Unsubscribed from trades:', pair);
    }
  }
}

export const socketService = new SocketService();