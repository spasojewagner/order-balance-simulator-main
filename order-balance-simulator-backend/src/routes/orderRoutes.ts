// routes/orderRoutes.ts - FIXED VERSION
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';

const router = Router();

// Validation rules for creating orders
const createOrderValidation = [
  body('pair')
    .notEmpty()
    .withMessage('Trading pair is required')
    .isString()
    .withMessage('Pair must be a string')
    .isLength({ min: 6, max: 12 })
    .withMessage('Pair must be between 6-12 characters'),
    
  body('type')
    .notEmpty()
    .withMessage('Order type is required')
    .isIn(['Limit Buy', 'Limit Sell', 'Market Buy', 'Market Sell'])
    .withMessage('Invalid order type'),
    
  body('price')
    .isFloat({ min: 0.000001 })
    .withMessage('Price must be a positive number'),
    
  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number'),
    
  body('status')
    .optional()
    .isIn(['Pending', 'Filled', 'Cancelled'])
    .withMessage('Invalid status'),
    
  body('no')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order number must be a positive integer'),
    
  body('orderTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
];

// Validation for updating orders
const updateOrderValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid order ID'),
    
  body('pair')
    .optional()
    .isString()
    .isLength({ min: 6, max: 12 }),
    
  body('type')
    .optional()
    .isIn(['Limit Buy', 'Limit Sell', 'Market Buy', 'Market Sell']),
    
  body('price')
    .optional()
    .isFloat({ min: 0.000001 }),
    
  body('amount')
    .optional()
    .isFloat({ min: 0.000001 }),
    
  body('status')
    .optional()
    .isIn(['Pending', 'Filled', 'Cancelled'])
];

// Query validation for filtering
const filterValidation = [
  query('pair').optional().isString(),
  query('status').optional().isIn(['Pending', 'Filled', 'Cancelled']),
  query('type').optional().isIn(['Limit Buy', 'Limit Sell', 'Market Buy', 'Market Sell']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

// ===== BASIC ROUTES =====
router.get('/', filterValidation, OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);

// ✅ FIXED: Use OrderController instead of non-existent EnhancedOrderController
router.post('/', createOrderValidation, OrderController.createOrder);
router.post('/bulk', OrderController.createBulkOrders);

router.put('/:id', updateOrderValidation, OrderController.updateOrder);
router.patch('/:id/fill', OrderController.fillOrder);
router.delete('/:id', OrderController.deleteOrder);

// ===== ENHANCED TRADING ROUTES =====
// Create enhanced order controller object with methods from trading service
const EnhancedOrderController = {
  // Cancel order using trading service
  cancelOrder: async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { pair } = req.query;
      
      if (!pair) {
        return res.status(400).json({
          success: false,
          message: 'Trading pair is required for cancellation'
        });
      }
      
      const result = await tradingService.cancelOrder(id, pair as string);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error: any) {
      console.error('❌ Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  },

  // Get order book
  getOrderBook: async (req: any, res: any) => {
    try {
      const { pair } = req.params;
      const orderBook = tradingService.getOrderBook(pair);
      
      if (!orderBook) {
        return res.status(404).json({
          success: false,
          message: `Order book not found for pair ${pair}`
        });
      }
      
      res.json({
        success: true,
        data: {
          pair,
          bids: orderBook.bids,
          asks: orderBook.asks,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ Get order book error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order book',
        error: error.message
      });
    }
  },

  // Get recent trades
  getRecentTrades: async (req: any, res: any) => {
    try {
      const { pair } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const trades = tradingService.getRecentTrades(pair, limit);
      
      res.json({
        success: true,
        data: {
          pair,
          trades,
          count: trades.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ Get recent trades error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recent trades',
        error: error.message
      });
    }
  },

  // Get market data
  getMarketData: async (req: any, res: any) => {
    try {
      const { pair } = req.params;
      const marketData = tradingService.getMarketData(pair);
      
      res.json({
        success: true,
        data: {
          ...marketData,
          pair,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ Get market data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get market data',
        error: error.message
      });
    }
  },

  // Get active pairs
  getActivePairs: async (req: any, res: any) => {
    try {
      const activePairs = tradingService.getActivePairs();
      
      res.json({
        success: true,
        data: {
          pairs: activePairs,
          count: activePairs.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ Get active pairs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active pairs',
        error: error.message
      });
    }
  }
};

// ✅ NOW THESE ROUTES WILL WORK
router.patch('/:id/cancel', EnhancedOrderController.cancelOrder);
router.get('/orderbook/:pair', EnhancedOrderController.getOrderBook);
router.get('/trades/:pair', EnhancedOrderController.getRecentTrades);
router.get('/market/:pair', EnhancedOrderController.getMarketData);
router.get('/active-pairs', EnhancedOrderController.getActivePairs);

export default router;