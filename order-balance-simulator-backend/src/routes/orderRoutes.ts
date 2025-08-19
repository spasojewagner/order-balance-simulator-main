// order-balance-simulator-backend/src/routes/orderRoutes.ts - FIXED PRICE HANDLING

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';

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

// 🔧 FIXED VALIDATION RULES
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

  // 🔧 FIXED: Better conditional price validation
  body('price')
    .custom((value, { req }) => {
      const orderType = req.body.type;
      
      console.log(`🔍 Validating price: ${value} for order type: ${orderType}`);

      // For market orders, price can be undefined, null, or 0
      if (orderType === 'Market Buy' || orderType === 'Market Sell') {
        // If price is provided for market orders, it should be positive or 0
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

// ===== FIXED CREATE ORDER ROUTE =====
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

    // 🔧 CRITICAL FIX: Handle price correctly for market orders
    let price;
    if (type === 'market') {
      // For market orders, remove price entirely or set to undefined
      price = undefined;
    } else {
      // For limit orders, use the provided price
      price = Number(orderData.price);
    }

    // Create the order object for database
    const formattedOrder = {
      pair: orderData.pair?.toUpperCase(),
      type: orderData.type, // Keep original type string for DB
      side, // For trading engine
      price, // undefined for market orders, number for limit orders
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

// ===== OTHER ROUTES =====
router.get('/', OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);
router.put('/:id', OrderController.updateOrder);

router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await OrderController.getOrderById(req, res);

    if (order) {
      const result = await tradingService.cancelOrder(id, order.pair);
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.patch('/:id/fill', OrderController.fillOrder);
router.delete('/:id', OrderController.deleteOrder);

// ===== TRADING SPECIFIC ROUTES =====
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

router.get('/pairs', async (req: Request, res: Response) => {
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