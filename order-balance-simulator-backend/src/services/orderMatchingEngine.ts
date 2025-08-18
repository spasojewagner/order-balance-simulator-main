// services/orderMatchingEngine.ts
import Order, { IOrder, OrderType, OrderStatus } from '../models/orderModel';
import { EventEmitter } from 'events';

interface OrderBookEntry {
  orderId: string;
  price: number;
  amount: number;
  timestamp: Date;
  order: IOrder;
}

interface Trade {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  amount: number;
  timestamp: Date;
  pair: string;
}

interface OrderBookState {
  bids: OrderBookEntry[];  // Buy orders (sorted by price desc, then timestamp asc)
  asks: OrderBookEntry[];  // Sell orders (sorted by price asc, then timestamp asc)
}

export class OrderMatchingEngine extends EventEmitter {
  private orderBooks: Map<string, OrderBookState> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private trades: Trade[] = [];
  
  constructor() {
    super();
    this.initializeOrderBooks();
  }

  /**
   * Initialize order books from existing pending orders in database
   */
  async initializeOrderBooks(): Promise<void> {
    try {
      console.log('🏗️ Initializing order books from database...');
      
      const pendingOrders = await Order.find({ 
        status: OrderStatus.PENDING 
      }).sort({ orderTime: 1 });

      for (const order of pendingOrders) {
        await this.addOrderToBook(order, false); // false = don't trigger matching yet
      }

      // Now trigger matching for all pairs
      for (const pair of this.orderBooks.keys()) {
        await this.matchOrders(pair);
      }

      console.log(`✅ Initialized ${this.orderBooks.size} order books with ${pendingOrders.length} pending orders`);
    } catch (error) {
      console.error('❌ Error initializing order books:', error);
    }
  }

  /**
   * Process a new order (main entry point)
   */
  async processOrder(order: IOrder): Promise<{ trades: Trade[], remainingOrder?: IOrder }> {
    const pair = order.pair.toUpperCase();
    console.log(`📊 Processing order ${order.no} for ${pair}: ${order.type} ${order.amount}@${order.price}`);

    try {
      // Handle market orders differently
      if (order.type === OrderType.MARKET_BUY || order.type === OrderType.MARKET_SELL) {
        return await this.processMarketOrder(order);
      }

      // Handle limit orders
      return await this.processLimitOrder(order);
    } catch (error) {
      console.error(`❌ Error processing order ${order.no}:`, error);
      throw error;
    }
  }

  /**
   * Process market order
   */
  private async processMarketOrder(order: IOrder): Promise<{ trades: Trade[], remainingOrder?: IOrder }> {
    const pair = order.pair.toUpperCase();
    const trades: Trade[] = [];
    let remainingAmount = order.amount;

    if (!this.orderBooks.has(pair)) {
      this.orderBooks.set(pair, { bids: [], asks: [] });
    }

    const book = this.orderBooks.get(pair)!;
    const isMarketBuy = order.type === OrderType.MARKET_BUY;
    const oppositeOrders = isMarketBuy ? book.asks : book.bids;

    // Sort to get best prices first
    this.sortOrderBook(pair);

    while (remainingAmount > 0 && oppositeOrders.length > 0) {
      const bestOpposite = oppositeOrders[0];
      const tradeAmount = Math.min(remainingAmount, bestOpposite.amount);
      const tradePrice = bestOpposite.price;

      // Create trade
      const trade: Trade = {
        buyOrderId: isMarketBuy ? order._id.toString() : bestOpposite.orderId,
        sellOrderId: isMarketBuy ? bestOpposite.orderId : order._id.toString(),
        price: tradePrice,
        amount: tradeAmount,
        timestamp: new Date(),
        pair: pair
      };

      trades.push(trade);
      this.trades.push(trade);

      // Update remaining amounts
      remainingAmount -= tradeAmount;
      bestOpposite.amount -= tradeAmount;

      // If opposite order is fully filled, remove it and mark as filled
      if (bestOpposite.amount === 0) {
        oppositeOrders.shift();
        await this.fillOrder(bestOpposite.order, trade.timestamp);
      }

      console.log(`🤝 Market trade executed: ${tradeAmount} ${pair} @ ${tradePrice}`);
    }

    // Update the market order
    if (remainingAmount === 0) {
      // Market order fully filled
      await this.fillOrder(order, new Date());
      this.emit('orderFilled', order, trades);
    } else {
      // Market order partially filled - this shouldn't happen in a real exchange
      // but we'll handle it by cancelling the remaining amount
      console.warn(`⚠️ Market order ${order.no} partially filled. Cancelling remaining ${remainingAmount}`);
      await order.cancel();
      this.emit('orderPartiallyFilled', order, trades);
    }

    this.emit('tradesExecuted', trades);
    return { trades, remainingOrder: remainingAmount > 0 ? order : undefined };
  }

  /**
   * Process limit order
   */
  private async processLimitOrder(order: IOrder): Promise<{ trades: Trade[], remainingOrder?: IOrder }> {
    const pair = order.pair.toUpperCase();
    let trades: Trade[] = [];

    // First try to match against existing orders
    const matchResult = await this.matchAgainstBook(order);
    trades = matchResult.trades;

    // If order has remaining amount, add to order book
    if (matchResult.remainingAmount > 0) {
      // Update the order amount in database
      order.amount = matchResult.remainingAmount;
      order.total = order.price * order.amount;
      await order.save();
      
      // Add to order book
      await this.addOrderToBook(order, false);
      this.emit('orderAddedToBook', order);
    } else {
      // Order fully filled
      await this.fillOrder(order, new Date());
      this.emit('orderFilled', order, trades);
    }

    if (trades.length > 0) {
      this.emit('tradesExecuted', trades);
    }

    return { 
      trades, 
      remainingOrder: matchResult.remainingAmount > 0 ? order : undefined 
    };
  }

  /**
   * Try to match an order against the existing order book
   */
  private async matchAgainstBook(order: IOrder): Promise<{ trades: Trade[], remainingAmount: number }> {
    const pair = order.pair.toUpperCase();
    const trades: Trade[] = [];
    let remainingAmount = order.amount;

    if (!this.orderBooks.has(pair)) {
      this.orderBooks.set(pair, { bids: [], asks: [] });
      return { trades, remainingAmount };
    }

    const book = this.orderBooks.get(pair)!;
    const isBuyOrder = order.type === OrderType.LIMIT_BUY;
    const oppositeOrders = isBuyOrder ? book.asks : book.bids;

    // Sort to ensure best prices first
    this.sortOrderBook(pair);

    while (remainingAmount > 0 && oppositeOrders.length > 0) {
      const bestOpposite = oppositeOrders[0];
      
      // Check if prices cross
      const canMatch = isBuyOrder 
        ? order.price >= bestOpposite.price  // Buy order price >= Ask price
        : order.price <= bestOpposite.price; // Sell order price <= Bid price

      if (!canMatch) {
        break; // No more matches possible
      }

      const tradeAmount = Math.min(remainingAmount, bestOpposite.amount);
      const tradePrice = bestOpposite.price; // Price priority: first come, first served

      // Create trade
      const trade: Trade = {
        buyOrderId: isBuyOrder ? order._id.toString() : bestOpposite.orderId,
        sellOrderId: isBuyOrder ? bestOpposite.orderId : order._id.toString(),
        price: tradePrice,
        amount: tradeAmount,
        timestamp: new Date(),
        pair: pair
      };

      trades.push(trade);
      this.trades.push(trade);

      // Update amounts
      remainingAmount -= tradeAmount;
      bestOpposite.amount -= tradeAmount;

      // If opposite order is fully filled, remove and update database
      if (bestOpposite.amount === 0) {
        oppositeOrders.shift();
        await this.fillOrder(bestOpposite.order, trade.timestamp);
      }

      console.log(`🤝 Trade executed: ${tradeAmount} ${pair} @ ${tradePrice} (Order ${order.no} vs ${bestOpposite.order.no})`);
    }

    return { trades, remainingAmount };
  }

  /**
   * Add order to the appropriate order book
   */
  private async addOrderToBook(order: IOrder, triggerMatching = true): Promise<void> {
    const pair = order.pair.toUpperCase();
    
    if (!this.orderBooks.has(pair)) {
      this.orderBooks.set(pair, { bids: [], asks: [] });
    }

    const book = this.orderBooks.get(pair)!;
    const orderBookEntry: OrderBookEntry = {
      orderId: order._id.toString(),
      price: order.price,
      amount: order.amount,
      timestamp: order.orderTime,
      order: order
    };

    if (order.type === OrderType.LIMIT_BUY) {
      book.bids.push(orderBookEntry);
    } else if (order.type === OrderType.LIMIT_SELL) {
      book.asks.push(orderBookEntry);
    }

    // Sort the order book
    this.sortOrderBook(pair);

    if (triggerMatching) {
      // Try to match against existing orders
      await this.matchOrders(pair);
    }
  }

  /**
   * Remove order from order book (when cancelled)
   */
  async removeOrderFromBook(orderId: string, pair: string): Promise<boolean> {
    const book = this.orderBooks.get(pair.toUpperCase());
    if (!book) return false;

    const bidIndex = book.bids.findIndex(entry => entry.orderId === orderId);
    if (bidIndex !== -1) {
      book.bids.splice(bidIndex, 1);
      return true;
    }

    const askIndex = book.asks.findIndex(entry => entry.orderId === orderId);
    if (askIndex !== -1) {
      book.asks.splice(askIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Sort order book entries
   */
  private sortOrderBook(pair: string): void {
    const book = this.orderBooks.get(pair);
    if (!book) return;

    // Sort bids: highest price first, then earliest timestamp
    book.bids.sort((a, b) => {
      if (a.price !== b.price) return b.price - a.price;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Sort asks: lowest price first, then earliest timestamp
    book.asks.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  /**
   * Trigger matching for a specific pair
   */
  private async matchOrders(pair: string): Promise<void> {
    if (this.isProcessing.get(pair)) return;
    this.isProcessing.set(pair, true);

    try {
      const book = this.orderBooks.get(pair);
      if (!book || book.bids.length === 0 || book.asks.length === 0) {
        return;
      }

      this.sortOrderBook(pair);
      const trades: Trade[] = [];

      while (book.bids.length > 0 && book.asks.length > 0) {
        const bestBid = book.bids[0];
        const bestAsk = book.asks[0];

        // Check if prices cross
        if (bestBid.price < bestAsk.price) {
          break; // No match possible
        }

        const tradeAmount = Math.min(bestBid.amount, bestAsk.amount);
        const tradePrice = bestAsk.price; // Price priority: ask price (earlier order)

        const trade: Trade = {
          buyOrderId: bestBid.orderId,
          sellOrderId: bestAsk.orderId,
          price: tradePrice,
          amount: tradeAmount,
          timestamp: new Date(),
          pair: pair
        };

        trades.push(trade);
        this.trades.push(trade);

        // Update amounts
        bestBid.amount -= tradeAmount;
        bestAsk.amount -= tradeAmount;

        // Remove filled orders
        if (bestBid.amount === 0) {
          book.bids.shift();
          await this.fillOrder(bestBid.order, trade.timestamp);
        }
        if (bestAsk.amount === 0) {
          book.asks.shift();
          await this.fillOrder(bestAsk.order, trade.timestamp);
        }

        console.log(`🤝 Auto-matched: ${tradeAmount} ${pair} @ ${tradePrice}`);
      }

      if (trades.length > 0) {
        this.emit('tradesExecuted', trades);
      }
    } finally {
      this.isProcessing.set(pair, false);
    }
  }

  /**
   * Mark order as filled in database
   */
  private async fillOrder(order: IOrder, filledTime: Date): Promise<void> {
    try {
      await order.fill(filledTime);
      this.emit('orderFilled', order);
    } catch (error) {
      console.error(`❌ Error filling order ${order.no}:`, error);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, pair: string): Promise<boolean> {
    const removed = await this.removeOrderFromBook(orderId, pair);
    if (removed) {
      this.emit('orderCancelled', orderId, pair);
    }
    return removed;
  }

  /**
   * Get current order book for a pair
   */
  getOrderBook(pair: string): OrderBookState | null {
    const book = this.orderBooks.get(pair.toUpperCase());
    if (!book) return null;

    // Return a deep copy to prevent external modifications
    return {
      bids: book.bids.map(entry => ({ ...entry })),
      asks: book.asks.map(entry => ({ ...entry }))
    };
  }

  /**
   * Get recent trades for a pair
   */
  getRecentTrades(pair: string, limit = 50): Trade[] {
    return this.trades
      .filter(trade => trade.pair === pair.toUpperCase())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get market data for a pair
   */
  getMarketData(pair: string) {
    const book = this.getOrderBook(pair);
    const recentTrades = this.getRecentTrades(pair, 100);
    
    if (!book) {
      return {
        pair,
        bestBid: null,
        bestAsk: null,
        spread: null,
        lastPrice: null,
        volume24h: 0,
        change24h: 0
      };
    }

    const bestBid = book.bids[0]?.price || null;
    const bestAsk = book.asks[0]?.price || null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
    const lastPrice = recentTrades[0]?.price || null;
    
    // Calculate 24h volume and change
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const trades24h = recentTrades.filter(t => t.timestamp.getTime() > last24h);
    const volume24h = trades24h.reduce((sum, trade) => sum + (trade.amount * trade.price), 0);
    
    const firstPriceToday = trades24h[trades24h.length - 1]?.price;
    const change24h = firstPriceToday && lastPrice 
      ? ((lastPrice - firstPriceToday) / firstPriceToday) * 100 
      : 0;

    return {
      pair,
      bestBid,
      bestAsk,
      spread,
      lastPrice,
      volume24h,
      change24h,
      orderBookDepth: {
        bids: book.bids.length,
        asks: book.asks.length
      }
    };
  }

  /**
   * Get all active trading pairs
   */
  getActivePairs(): string[] {
    return Array.from(this.orderBooks.keys());
  }

  /**
   * Clean up old trades (call periodically)
   */
  cleanupOldTrades(daysToKeep = 30): void {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const initialLength = this.trades.length;
    
    this.trades = this.trades.filter(trade => 
      trade.timestamp.getTime() > cutoff
    );
    
    const removed = initialLength - this.trades.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old trades`);
    }
  }
}

// Singleton instance
export const matchingEngine = new OrderMatchingEngine();