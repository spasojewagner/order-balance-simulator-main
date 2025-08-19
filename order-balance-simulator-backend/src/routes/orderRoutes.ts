// order-balance-simulator-backend/src/routes/orderRoutes.ts - COMPLETE VERSION WITH TX HASH

import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';

const router = Router();

// Middleware for validation
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

// Validation rules for creating order
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
    .optional() // Optional for market orders
    .isFloat({ min: 0.000001 })
    .withMessage('Price must be a positive number'),
    
  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number'),
    
  body('walletAddress')
    .optional()
    .isLength({ min: 42, max: 42 })
    .withMessage('Invalid wallet address')
];

// ===== ENHANCED CREATE ORDER WITH MATCHING =====
router.post('/', createOrderValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    
    console.log('📝 Creating order with matching:', orderData);
    
    // Convert type format
    let side = 'buy';
    let type = 'limit';
    
    // if (orderData.type.includes('Buy')) side = 'buy';
    // if (orderData.type.includes('Sell')) side = 'sell';
    // if (orderData.type.includes('Market')) type = 'market';
    // if (orderData.type.includes('Limit')) type = 'limit';
    const originalType = orderData.type; // Sačuvaj originalni type
orderData.type = originalType;
    
    const formattedOrder = {
      ...orderData,
      side,
      type,
      price: type === 'market' ? 0 : orderData.price
    };
    
    // Call trading service for matching
    const result = await tradingService.placeOrder(formattedOrder);
    
    if (result.success) {
      console.log('✅ Order placed and matched:', result.data);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message,
        trades: result.data?.trades || []
      });
    } else {
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
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const trades = tradingService.getRecentTrades('BTCUSDT', Number(limit));
    
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

// ===== GET USER ORDERS =====
router.get('/user/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const Order = require('../models/orderModel').default;
    
    const orders = await Order.find({ 
      walletAddress: walletAddress.toLowerCase() 
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== OTHER ROUTES (existing) =====
router.get('/', OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);

router.put('/:id', OrderController.updateOrder);

// ===== CANCEL ORDER =====
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const Order = require('../models/orderModel').default;
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const result = await tradingService.cancelOrder(id, order.pair);
    res.json(result);
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

export default router;