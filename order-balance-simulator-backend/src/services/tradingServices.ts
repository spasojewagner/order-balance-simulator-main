// services/tradingServices.ts - FIXED VERSION
import Order, { IOrder, OrderType, OrderStatus, OrderService } from '../models/orderModel';
import { Server as IOServer } from 'socket.io';

// Import the matching engine class, not the singleton
import { OrderMatchingEngine } from './orderMatchingEngine';

export class TradingService {
  private io: IOServer | null = null;
  private matchingEngine: OrderMatchingEngine;

  constructor() {
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
      if (this.io) {
        // Emit updated order book
        const orderBook = this.matchingEngine.getOrderBook(order.pair);
        this.io.emit(`orderbook_${order.pair}`, orderBook);
      }
    });

    this.matchingEngine.on('orderCancelled', (orderId, pair) => {
      console.log(`❌ Order ${orderId} cancelled from ${pair}`);
      if (this.io) {
        this.io.emit(`order_update_${orderId}`, {
          orderId: orderId,
          status: 'cancelled'
        });
        
        // Emit updated order book
        const orderBook = this.matchingEngine.getOrderBook(pair);
        this.io.emit(`orderbook_${pair}`, orderBook);
      }
    });
  }

  /**
   * Create and process a new order
   */
  async createOrder(orderData: Partial<IOrder>): Promise<{
    order: IOrder,
    trades: any[],
    success: boolean,
    message: string
  }> {
    try {
      // Create the order in database first
      const order = await OrderService.createOrder(orderData);
      
      // Process through matching engine
      const result = await this.matchingEngine.processOrder(order);
      
      return {
        order: result.remainingOrder || order,
        trades: result.trades,
        success: true,
        message: result.trades.length > 0 
          ? `Order created and ${result.trades.length} trades executed`
          : 'Order created and added to book'
      };
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      return {
        order: null as any,
        trades: [],
        success: false,
        message: error.message || 'Failed to create order'
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean, message: string }> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      if (order.status !== OrderStatus.PENDING) {
        return { success: false, message: 'Can only cancel pending orders' };
      }

      // Remove from matching engine
      const removed = await this.matchingEngine.cancelOrder(orderId, order.pair);
      
      // Update database
      await order.cancel();

      return {
        success: true,
        message: removed ? 'Order cancelled and removed from book' : 'Order cancelled'
      };
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
    } catch (error) {
      console.error('❌ Failed to initialize trading service:', error);
      throw error;
    }
  }

  /**
   * Cleanup old trades (call periodically)
   */
  cleanup(): void {
    this.matchingEngine.cleanupOldTrades();
  }
}

// Singleton instance
export const tradingService = new TradingService();

// Updated OrderController methods to use matching engine
export const EnhancedOrderController = {
  // Enhanced create order method
  async createOrder(req: any, res: any, next: any) {
    try {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const result = await tradingService.createOrder(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.status(201).json({
        success: true,
        data: {
          order: result.order,
          trades: result.trades,
          tradesExecuted: result.trades.length
        },
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  },

  // Enhanced cancel order method
  async cancelOrder(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      
      const result = await tradingService.cancelOrder(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  },

  // Get order book
  async getOrderBook(req: any, res: any, next: any) {
    try {
      const { pair } = req.params;
      const orderBook = tradingService.getOrderBook(pair);
      
      if (!orderBook) {
        return res.status(404).json({
          success: false,
          message: 'Order book not found for this pair'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          pair: pair.toUpperCase(),
          timestamp: new Date(),
          bids: orderBook.bids.map(entry => ({
            price: entry.price,
            amount: entry.amount,
            total: entry.price * entry.amount
          })),
          asks: orderBook.asks.map(entry => ({
            price: entry.price,
            amount: entry.amount,
            total: entry.price * entry.amount
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get recent trades
  async getRecentTrades(req: any, res: any, next: any) {
    try {
      const { pair } = req.params;
      const { limit } = req.query;
      const trades = tradingService.getRecentTrades(pair, parseInt(limit as string) || 50);

      res.status(200).json({
        success: true,
        data: {
          pair: pair.toUpperCase(),
          trades: trades,
          count: trades.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get market data
  async getMarketData(req: any, res: any, next: any) {
    try {
      const { pair } = req.params;
      const marketData = tradingService.getMarketData(pair);

      res.status(200).json({
        success: true,
        data: marketData
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all active pairs
  async getActivePairs(req: any, res: any, next: any) {
    try {
      const pairs = tradingService.getActivePairs();
      const marketDataPromises = pairs.map(pair => ({
        pair,
        ...tradingService.getMarketData(pair)
      }));

      res.status(200).json({
        success: true,
        data: {
          pairs: marketDataPromises,
          count: pairs.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
};