// order-balance-simulator-backend/src/services/orderMatchingEngine.ts
import Order, { IOrder, OrderType, OrderStatus } from '../models/orderModel';
import Trade, { ITrade } from '../models/tradeModel'; // DODATO
import { EventEmitter } from 'events';

interface OrderBookEntry {
  orderId: string;
  price: number;
  amount: number;
  timestamp: Date;
  order: IOrder;
}

interface TradeData {
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
  private trades: TradeData[] = [];
  
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
  async processOrder(order: IOrder): Promise<{ trades: TradeData[], remainingOrder?: IOrder }> {
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
/**
 * 🔧 FIXED: Process market order with proper price fallback
 */
private async processMarketOrder(order: IOrder): Promise<{ trades: TradeData[], remainingOrder?: IOrder }> {
  const pair = order.pair.toUpperCase();
  const trades: TradeData[] = [];
  let remainingAmount = order.amount;

  if (!this.orderBooks.has(pair)) {
    this.orderBooks.set(pair, { bids: [], asks: [] });
  }

  const book = this.orderBooks.get(pair)!;
  const isMarketBuy = order.type === OrderType.MARKET_BUY;
  const oppositeOrders = isMarketBuy ? book.asks : book.bids;

  // Check if there are any valid opposite orders
  if (oppositeOrders.length === 0) {
    console.log(`⚠️ No opposite orders available for market ${isMarketBuy ? 'buy' : 'sell'} on ${pair}`);
    order.status = OrderStatus.CANCELLED;
    await order.save();
    return { trades: [], remainingOrder: undefined };
  }

  while (oppositeOrders.length > 0 && remainingAmount > 0) {
    const bestOpposite = oppositeOrders[0];
    const tradeAmount = Math.min(remainingAmount, bestOpposite.amount);
    
    // 🔧 KRITIČNA ISPRAVKA: Use market order price as fallback if opposite order has no price
    let tradePrice = bestOpposite.price;
    
    if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
      console.log(`⚠️ Opposite order has invalid price (${tradePrice}), using market order price: ${order.price}`);
      tradePrice = order.price;
      
      // If market order also has no price, skip this matching
      if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
        console.error(`❌ Both orders have invalid prices. Skipping match.`);
        oppositeOrders.shift(); // Remove invalid opposite order
        continue;
      }
    }

    console.log(`💱 Market trade: ${tradeAmount} ${pair} @ ${tradePrice} (opposite: ${bestOpposite.price}, market: ${order.price})`);

    // Create trade with validated price
    const trade: TradeData = {
      buyOrderId: isMarketBuy ? order._id.toString() : bestOpposite.orderId,
      sellOrderId: isMarketBuy ? bestOpposite.orderId : order._id.toString(),
      price: tradePrice, // ✅ Now guaranteed to be valid
      amount: tradeAmount,
      timestamp: new Date(),
      pair: pair
    };

    trades.push(trade);
    this.trades.push(trade);

    // Save trade to database with blockchain execution
    await this.executeTrade(trade, 
      isMarketBuy ? order : bestOpposite.order,
      isMarketBuy ? bestOpposite.order : order
    );

    // Update amounts
    remainingAmount -= tradeAmount;
    bestOpposite.amount -= tradeAmount;

    // If opposite order is fully filled, remove and update database
    if (bestOpposite.amount === 0) {
      oppositeOrders.shift();
      await this.fillOrder(bestOpposite.order, trade.timestamp);
    }

    console.log(`🤝 Trade executed: ${tradeAmount} ${pair} @ ${tradePrice}`);
  }

  // Update market order status
  if (remainingAmount === 0) {
    await this.fillOrder(order, new Date());
    console.log(`✅ Order ${order.no} filled`);
    this.emit('orderFilled', order, trades);
  } else if (trades.length > 0) {
    // Partial fill for market order
    order.filledAmount = order.amount - remainingAmount;
    order.remainingAmount = remainingAmount;
    await order.save();
    console.log(`⚡ Order ${order.no} partially filled: ${order.filledAmount}/${order.amount}`);
    this.emit('orderPartiallyFilled', order, trades);
  } else {
    // No trades executed
    console.log(`❌ Market order ${order.no} couldn't be executed`);
    order.status = OrderStatus.CANCELLED;
    await order.save();
  }

  if (trades.length > 0) {
    console.log(`📈 ${trades.length} trades executed`);
    this.emit('tradesExecuted', trades);
  }

  return { trades, remainingOrder: remainingAmount > 0 ? order : undefined };
}
  /**
   * Process limit order
   */
  private async processLimitOrder(order: IOrder): Promise<{ trades: TradeData[], remainingOrder?: IOrder }> {
    const pair = order.pair.toUpperCase();
    const trades: TradeData[] = [];
    
    // Try to match with existing orders first
    const matchResult = await this.matchWithExistingOrders(order);
    trades.push(...matchResult.trades);

    // If order is not fully filled, add to order book
    if (matchResult.remainingAmount > 0) {
      order.amount = matchResult.remainingAmount;
      order.filledAmount = (order.filledAmount || 0) + (order.amount - matchResult.remainingAmount);
      order.remainingAmount = matchResult.remainingAmount;
      await order.save();
      
      await this.addOrderToBook(order);
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
   * Match order with existing orders in the book
   */
  private async matchWithExistingOrders(order: IOrder): Promise<{ trades: TradeData[], remainingAmount: number }> {
    const pair = order.pair.toUpperCase();
    const trades: TradeData[] = [];
    let remainingAmount = order.amount;

    if (!this.orderBooks.has(pair)) {
      this.orderBooks.set(pair, { bids: [], asks: [] });
      return { trades, remainingAmount };
    }

    const book = this.orderBooks.get(pair)!;
    const isBuyOrder = order.type === OrderType.LIMIT_BUY;
    const oppositeOrders = isBuyOrder ? book.asks : book.bids;

    while (oppositeOrders.length > 0 && remainingAmount > 0) {
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
      const trade: TradeData = {
        buyOrderId: isBuyOrder ? order._id.toString() : bestOpposite.orderId,
        sellOrderId: isBuyOrder ? bestOpposite.orderId : order._id.toString(),
        price: tradePrice,
        amount: tradeAmount,
        timestamp: new Date(),
        pair: pair
      };

      trades.push(trade);
      this.trades.push(trade);

      // Save trade to database with blockchain execution
      await this.executeTrade(trade,
        isBuyOrder ? order : bestOpposite.order,
        isBuyOrder ? bestOpposite.order : order
      );

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
   * Execute trade and save to database with blockchain execution
   */
  private async executeTrade(trade: TradeData, buyOrder: IOrder, sellOrder: IOrder): Promise<void> {
    try {
      // Generate unique trade ID
      const tradeId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save trade to database
      const tradeDoc = new Trade({
        tradeId,
        buyOrderId: trade.buyOrderId,
        sellOrderId: trade.sellOrderId,
        buyerAddress: buyOrder.walletAddress || '0x0000000000000000000000000000000000000000',
        sellerAddress: sellOrder.walletAddress || '0x0000000000000000000000000000000000000000',
        pair: trade.pair,
        price: trade.price,
        amount: trade.amount,
        total: trade.price * trade.amount,
        timestamp: trade.timestamp,
        onChainStatus: 'pending'
      });
      
      await tradeDoc.save();
      console.log(`💾 Trade saved to DB: ${tradeDoc.tradeId}`);
      
      // Execute on blockchain asynchronously
      if (process.env.BLOCKCHAIN_MOCK_MODE !== 'true') {
        this.executeOnBlockchain(tradeDoc).catch(error => {
          console.error('❌ Blockchain execution failed:', error);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to save trade:', error);
    }
  }

  /**
   * Execute trade on blockchain
   */
  private async executeOnBlockchain(trade: ITrade): Promise<void> {
    try {
      const { blockchainService } = require('./blockchainServices');
      
      console.log(`🔗 Executing trade ${trade.tradeId} on blockchain...`);
      
      const result = await blockchainService.executeTradeOnChain({
        tradeId: trade.tradeId,
        buyerAddress: trade.buyerAddress,
        sellerAddress: trade.sellerAddress,
        amount: trade.amount.toString(),
        price: trade.price.toString(),
        pair: trade.pair
      });
      
      if (result.success) {
        // Update trade with blockchain data
        trade.txHash = result.txHash;
        trade.blockNumber = result.blockNumber;
        trade.gasUsed = result.gasUsed;
        trade.onChainStatus = 'confirmed';
        await trade.save();
        
        console.log(`✅ Trade ${trade.tradeId} confirmed on-chain: ${result.txHash}`);
        
        // Emit event for confirmed trade
        this.emit('tradeOnChainConfirmed', {
          tradeId: trade.tradeId,
          txHash: result.txHash,
          blockNumber: result.blockNumber
        });
        
      } else {
        trade.onChainStatus = 'failed';
        trade.blockchainError = result.error;
        await trade.save();
        
        console.error(`❌ Trade ${trade.tradeId} failed on-chain: ${result.error}`);
        
        this.emit('tradeOnChainFailed', {
          tradeId: trade.tradeId,
          error: result.error
        });
      }
    } catch (error: any) {
      console.error('❌ Blockchain execution error:', error);
      trade.onChainStatus = 'failed';
      trade.blockchainError = error.message;
      await trade.save();
      
      this.emit('tradeOnChainFailed', {
        tradeId: trade.tradeId,
        error: error.message
      });
    }
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
    const isBuyOrder = order.type === OrderType.LIMIT_BUY;
    const targetBook = isBuyOrder ? book.bids : book.asks;

    const entry: OrderBookEntry = {
      orderId: order._id.toString(),
      price: order.price,
      amount: order.remainingAmount || order.amount,
      timestamp: order.orderTime || new Date(),
      order: order
    };

    targetBook.push(entry);
    this.sortOrderBook(pair);

    if (triggerMatching) {
      await this.matchOrders(pair);
    }
  }

  /**
   * Sort order book
   */
  private sortOrderBook(pair: string): void {
    const book = this.orderBooks.get(pair);
    if (!book) return;

    // Sort bids: highest price first, then oldest first
    book.bids.sort((a, b) => {
      if (a.price !== b.price) return b.price - a.price;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Sort asks: lowest price first, then oldest first
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
      const trades: TradeData[] = [];

      while (book.bids.length > 0 && book.asks.length > 0) {
        const bestBid = book.bids[0];
        const bestAsk = book.asks[0];

        // Check if prices cross
        if (bestBid.price < bestAsk.price) {
          break; // No match possible
        }

        const tradeAmount = Math.min(bestBid.amount, bestAsk.amount);
        const tradePrice = bestAsk.price; // Price priority: ask price (earlier order)

        const trade: TradeData = {
          buyOrderId: bestBid.orderId,
          sellOrderId: bestAsk.orderId,
          price: tradePrice,
          amount: tradeAmount,
          timestamp: new Date(),
          pair: pair
        };

        trades.push(trade);
        this.trades.push(trade);

        // Save trade to database with blockchain execution
        await this.executeTrade(trade, bestBid.order, bestAsk.order);

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
   * Mark order as filled
   */
  private async fillOrder(order: IOrder, filledTime: Date): Promise<void> {
    order.status = OrderStatus.FILLED;
    order.filledTime = filledTime;
    order.filledAmount = order.amount;
    order.remainingAmount = 0;
    await order.save();
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, pair: string): Promise<boolean> {
    const book = this.orderBooks.get(pair.toUpperCase());
    if (!book) return false;

    // Check in bids
    const bidIndex = book.bids.findIndex(b => b.orderId === orderId);
    if (bidIndex !== -1) {
      book.bids.splice(bidIndex, 1);
      return true;
    }

    // Check in asks
    const askIndex = book.asks.findIndex(a => a.orderId === orderId);
    if (askIndex !== -1) {
      book.asks.splice(askIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Get order book for a pair
   */
  getOrderBook(pair: string): { bids: any[], asks: any[] } {
    const book = this.orderBooks.get(pair.toUpperCase());
    if (!book) return { bids: [], asks: [] };

    return {
      bids: book.bids.map(b => ({
        price: b.price,
        amount: b.amount,
        total: b.price * b.amount,
        orderId: b.orderId
      })),
      asks: book.asks.map(a => ({
        price: a.price,
        amount: a.amount,
        total: a.price * a.amount,
        orderId: a.orderId
      }))
    };
  }

  /**
   * Get recent trades for a pair
   */
  getRecentTrades(pair: string, limit = 50): TradeData[] {
    return this.trades
      .filter(t => t.pair === pair.toUpperCase())
      .slice(-limit)
      .reverse();
  }

  /**
   * Get market data for a pair
   */
  getMarketData(pair: string): any {
    const pairTrades = this.trades.filter(t => t.pair === pair.toUpperCase());
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades24h = pairTrades.filter(t => t.timestamp > last24h);

    if (trades24h.length === 0) {
      return {
        pair,
        lastPrice: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
        change24h: 0,
        changePercent24h: 0
      };
    }

    const prices = trades24h.map(t => t.price);
    const volumes = trades24h.map(t => t.amount);
    
    return {
      pair,
      lastPrice: pairTrades[pairTrades.length - 1]?.price || 0,
      volume24h: volumes.reduce((a, b) => a + b, 0),
      high24h: Math.max(...prices),
      low24h: Math.min(...prices),
      change24h: 0, // Would need historical data
      changePercent24h: 0 // Would need historical data
    };
  }

  /**
   * Get all active trading pairs
   */
  getActivePairs(): string[] {
    return Array.from(this.orderBooks.keys());
  }

  /**
   * Cleanup old trades (keep last 1000)
   */
  cleanupOldTrades(): void {
    if (this.trades.length > 1000) {
      this.trades = this.trades.slice(-1000);
    }
  }
}