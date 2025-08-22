// order-balance-simulator-backend/src/routes/orderRoutes.ts - FIXED CANCEL ROUTE

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';
import Order from '../models/orderModel'; // Import Order model directly

const router = Router();

// Middleware za validaciju
const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Validation rules
const createOrderValidation = [
  body('pair')
    .notEmpty()
    .withMessage('Trading pair is required')
    .isString()
    .withMessage('Pair must be a string'),

  body('type')
    .notEmpty()
    .withMessage('Order type is required')
    .isIn(['Limit Buy', 'Limit Sell', 'Market Buy', 'Market Sell'])
    .withMessage('Invalid order type'),

  body('price')
    .custom((value, { req }) => {
      const orderType = req.body.type;
      
      console.log(`🔍 Validating price: ${value} for order type: ${orderType}`);

      // For market orders, price can be undefined, null, or 0
      if (orderType === 'Market Buy' || orderType === 'Market Sell') {
        if (value !== undefined && value !== null) {
          if (typeof value !== 'number') {
            throw new Error('Price must be a number');
          }
          if (value < 0) {
            throw new Error('Price cannot be negative');
          }
        }
        return true;
      }

      // For limit orders, price is required and must be > 0
      if (orderType === 'Limit Buy' || orderType === 'Limit Sell') {
        if (value === undefined || value === null) {
          throw new Error('Price is required for limit orders');
        }
        if (typeof value !== 'number' || value <= 0) {
          throw new Error('Price must be a positive number for limit orders');
        }
      }

      return true;
    }),

  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number'),

  body('walletAddress')
    .optional()
    .isLength({ min: 42, max: 42 })
    .withMessage('Invalid wallet address')
];

// ===== CREATE ORDER ROUTE =====
router.post('/', createOrderValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const orderData = req.body;

    console.log('📝 Creating order:', orderData);

    // Determine side and type for trading engine
    let side = 'buy';
    let type = 'limit';

    if (orderData.type.includes('Buy')) side = 'buy';
    if (orderData.type.includes('Sell')) side = 'sell';
    if (orderData.type.includes('Market')) type = 'market';
    if (orderData.type.includes('Limit')) type = 'limit';

    // Handle price correctly for market orders
    let price;
    if (type === 'market') {
      price = undefined;
    } else {
      price = Number(orderData.price);
    }

    // Create the order object for database
    const formattedOrder = {
      pair: orderData.pair?.toUpperCase(),
      type: orderData.type,
      side,
      price,
      amount: Number(orderData.amount),
      walletAddress: orderData.walletAddress,
      orderTime: new Date(),
      status: 'Pending'
    };

    console.log('📝 Formatted order for DB:', formattedOrder);

    // Create order using trading service
    const result = await tradingService.placeOrder(formattedOrder);

    if (result.success) {
      console.log('✅ Order placed successfully:', result.data);

      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message || 'Order placed successfully',
        trades: result.data?.trades || []
      });
    } else {
      console.error('❌ Order placement failed:', result);
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
});

// ===== 🔧 FIXED CANCEL ORDER ROUTE =====
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log('🚫 Attempting to cancel order:', id);

    // 1. First get the order from database directly
    const order = await Order.findById(id);
    
    if (!order) {
      console.log('❌ Order not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('📋 Found order to cancel:', {
      id: order._id,
      pair: order.pair,
      type: order.type,
      status: order.status
    });

    // 2. Check if order can be cancelled
    if (order.status === 'Filled' || order.status === 'Canceled') {
      console.log('❌ Order cannot be cancelled, current status:', order.status);
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`
      });
    }

    // 3. Cancel through trading service first (if it's still in the order book)
    try {
      const tradingResult = await tradingService.cancelOrder(id, order.pair);
      console.log('🎯 Trading service cancel result:', tradingResult);
    } catch (tradingError) {
      console.warn('⚠️ Trading service cancel failed (order might already be filled):', tradingError);
      // Continue with database update anyway
    }

    // 4. Update order status in database
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { 
        status: 'Canceled',
        canceledTime: new Date()
      },
      { new: true }
    );

    if (!updatedOrder) {
      console.log('❌ Failed to update order in database');
      return res.status(500).json({
        success: false,
        message: 'Failed to update order status'
      });
    }

    console.log('✅ Order cancelled successfully:', {
      id: updatedOrder._id,
      status: updatedOrder.status
    });

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order cancelled successfully'
    });

  } catch (error: any) {
    console.error('❌ Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
});

// ===== OTHER ROUTES =====
router.get('/', OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);
router.put('/:id', OrderController.updateOrder);
router.patch('/:id/fill', OrderController.fillOrder);
router.delete('/:id', OrderController.deleteOrder);

// ===== GET ORDER BOOK =====
router.get('/orderbook/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const orderBook = tradingService.getOrderBook(pair.toUpperCase());

    res.json({
      success: true,
      data: orderBook
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== GET RECENT TRADES =====
router.get('/trades/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const { limit = 50 } = req.query;

    const trades = tradingService.getRecentTrades(pair.toUpperCase(), Number(limit));

    res.json({
      success: true,
      data: trades
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== GET MARKET DATA =====
router.get('/market/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const marketData = tradingService.getMarketData(pair.toUpperCase());

    res.json({
      success: true,
      data: marketData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== GET ACTIVE PAIRS =====
router.get('/active-pairs', async (req: Request, res: Response) => {
  try {
    const pairs = tradingService.getActivePairs();

    res.json({
      success: true,
      data: pairs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== GET TRADES WITH TX HASH =====
router.get('/trades-with-tx/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const { limit = 50 } = req.query;

    const Trade = require('../models/tradeModel').default;
    const trades = await Trade.find({ pair: pair.toUpperCase() })
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      data: trades.map(t => ({
        tradeId: t.tradeId,
        price: t.price,
        amount: t.amount,
        total: t.total,
        timestamp: t.timestamp,
        txHash: t.txHash,
        blockNumber: t.blockNumber,
        onChainStatus: t.onChainStatus,
        gasUsed: t.gasUsed,
        buyerAddress: t.buyerAddress,
        sellerAddress: t.sellerAddress
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;