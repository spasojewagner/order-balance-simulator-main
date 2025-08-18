// backend/src/services/tradingServices.ts - FIXED WITH EVENTEMITTER

import Order, { IOrder, OrderType, OrderStatus, OrderService } from '../models/orderModel';
import { Server as IOServer } from 'socket.io';
import { EventEmitter } from 'events'; // 🆕 DODANO

// Import the matching engine class, not the singleton
import { OrderMatchingEngine } from './orderMatchingEngine';

export class TradingService extends EventEmitter { // 🆕 EXTENDS EVENTEMITTER
  private io: IOServer | null = null;
  private matchingEngine: OrderMatchingEngine;

  constructor() {
    super(); // 🆕 POZOVI SUPER()
    // Create the matching engine instance here
    this.matchingEngine = new OrderMatchingEngine();
    this.setupEventListeners();
  }

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io: IOServer): void {
    this.io = io;
  }

  /**
   * Setup event listeners for the matching engine
   */
  private setupEventListeners(): void {
    this.matchingEngine.on('tradesExecuted', (trades) => {
      console.log(`📈 ${trades.length} trades executed`);
      
      // 🆕 EMIT CUSTOM EVENT
      this.emit('tradesExecuted', trades);
      
      // Emit to all connected clients
      if (this.io) {
        trades.forEach(trade => {
          this.io!.emit(`trade_${trade.pair}`, {
            pair: trade.pair,
            price: trade.price,
            amount: trade.amount,
            timestamp: trade.timestamp,
            type: 'trade'
          });
        });
      }

      // Update market data for each affected pair
      const pairs = [...new Set(trades.map(t => t.pair))];
      pairs.forEach(pair => {
        const marketData = this.matchingEngine.getMarketData(pair);
        if (this.io) {
          this.io.emit(`market_data_${pair}`, marketData);
        }
      });
    });

    this.matchingEngine.on('orderFilled', (order, trades = []) => {
      console.log(`✅ Order ${order.no} filled`);
      
      // 🆕 EMIT CUSTOM EVENT
      this.emit('orderFilled', order, trades);
      
      if (this.io) {
        this.io.emit(`order_update_${order._id}`, {
          orderId: order._id,
          status: 'filled',
          filledTime: order.filledTime,
          trades: trades
        });
      }
    });

    this.matchingEngine.on('orderPartiallyFilled', (order, trades) => {
      console.log(`🔄 Order ${order.no} partially filled`);
      
      // 🆕 EMIT CUSTOM EVENT
      this.emit('orderPartiallyFilled', order, trades);
      
      if (this.io) {
        this.io.emit(`order_update_${order._id}`, {
          orderId: order._id,
          status: 'partially_filled',
          remainingAmount: order.amount,
          trades: trades
        });
      }
    });

    this.matchingEngine.on('orderAddedToBook', (order) => {
      console.log(`📝 Order ${order.no} added to book`);
      
      // 🆕 EMIT CUSTOM EVENT
      this.emit('orderAddedToBook', order);
      
      if (this.io) {
        // Emit updated order book
        const orderBook = this.matchingEngine.getOrderBook(order.pair);
        this.io.emit(`orderbook_update_${order.pair}`, orderBook);
      }
    });

    // 🆕 DODAJ NOVI EVENT ZA ORDER MATCHING
    this.matchingEngine.on('orderMatched', (buyOrder: IOrder, sellOrder: IOrder, trades: any[]) => {
      console.log(`🎯 Orders matched: ${buyOrder._id} ↔ ${sellOrder._id}`);
      
      // Emit custom event for server.ts
      this.emit('orderMatched', buyOrder, sellOrder, trades);
    });
  }

  /**
   * Place a new order
   */
  async placeOrder(orderData: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`📝 Placing order: ${orderData.pair} ${orderData.side} ${orderData.amount}@${orderData.price}`);
      
      // Create order in database first
      const order = await OrderService.createOrder(orderData);
      
      // Process order through matching engine
      const result = await this.matchingEngine.processOrder(order);
      
      console.log(`✅ Order ${order.no} placed successfully`);
      
      return {
        success: true,
        message: 'Order placed successfully',
        data: {
          orderId: order._id,
          orderNo: order.no,
          trades: result.trades,
          remainingOrder: result.remainingOrder
        }
      };
    } catch (error: any) {
      console.error('❌ Error placing order:', error);
      return { success: false, message: error.message || 'Failed to place order' };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, pair: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`❌ Cancelling order: ${orderId} for ${pair}`);
      
      // Remove from matching engine
      const removed = await this.matchingEngine.cancelOrder(orderId, pair);
      
      if (removed) {
        // Update order status in database
        const order = await Order.findById(orderId);
        if (order) {
          await order.cancel();
        }
        
        console.log(`✅ Order ${orderId} cancelled successfully`);
        return { success: true, message: 'Order cancelled successfully' };
      } else {
        return { success: false, message: 'Order not found or already executed' };
      }
    } catch (error: any) {
      console.error('❌ Error cancelling order:', error);
      return { success: false, message: error.message || 'Failed to cancel order' };
    }
  }

  /**
   * Get order book for a trading pair
   */
  getOrderBook(pair: string) {
    return this.matchingEngine.getOrderBook(pair);
  }

  /**
   * Get recent trades for a pair
   */
  getRecentTrades(pair: string, limit = 50) {
    return this.matchingEngine.getRecentTrades(pair, limit);
  }

  /**
   * Get market data for a pair
   */
  getMarketData(pair: string) {
    return this.matchingEngine.getMarketData(pair);
  }

  /**
   * Get all active trading pairs
   */
  getActivePairs(): string[] {
    return this.matchingEngine.getActivePairs();
  }

  /**
   * Initialize the matching engine (call on server startup)
   */
  async initialize(): Promise<void> {
    try {
      await this.matchingEngine.initializeOrderBooks();
      console.log('🚀 Trading service initialized');
      
      // 🆕 EMIT INITIALIZATION EVENT
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize trading service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Cleanup old trades (call periodically)
   */
  cleanup(): void {
    this.matchingEngine.cleanupOldTrades();
    console.log('🧹 Trading service cleanup completed');
    
    // 🆕 EMIT CLEANUP EVENT
    this.emit('cleanup');
  }

  /**
   * Get service statistics
   */
  getStats() {
    const activePairs = this.getActivePairs();
    const stats = {
      activePairs: activePairs.length,
      pairsList: activePairs,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    return stats;
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      healthy: true,
      matchingEngine: !!this.matchingEngine,
      socketIO: !!this.io,
      activePairs: this.getActivePairs().length,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
export const tradingService = new TradingService();

// 🆕 DODAJ TYPE DEFINITIONS ZA EVENTS
declare interface TradingService {
  on(event: 'tradesExecuted', listener: (trades: any[]) => void): this;
  on(event: 'orderFilled', listener: (order: IOrder, trades: any[]) => void): this;
  on(event: 'orderPartiallyFilled', listener: (order: IOrder, trades: any[]) => void): this;
  on(event: 'orderAddedToBook', listener: (order: IOrder) => void): this;
  on(event: 'orderMatched', listener: (buyOrder: IOrder, sellOrder: IOrder, trades: any[]) => void): this;
  on(event: 'initialized', listener: () => void): this;
  on(event: 'cleanup', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  
  emit(event: 'tradesExecuted', trades: any[]): boolean;
  emit(event: 'orderFilled', order: IOrder, trades: any[]): boolean;
  emit(event: 'orderPartiallyFilled', order: IOrder, trades: any[]): boolean;
  emit(event: 'orderAddedToBook', order: IOrder): boolean;
  emit(event: 'orderMatched', buyOrder: IOrder, sellOrder: IOrder, trades: any[]): boolean;
  emit(event: 'initialized'): boolean;
  emit(event: 'cleanup'): boolean;
  emit(event: 'error', error: Error): boolean;
}