// routes/orderRoutes.ts - ZAMIJENI POSTOJEĆI
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { EnhancedOrderController } from '../services/tradingServices'; // 🔥 DODANO

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

// ===== OSNOVNE RUTE (postojeće) =====
router.get('/', filterValidation, OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);

// 🔥 MIJENJAJ OVU LINIJU - koristi EnhancedOrderController umjesto OrderController
router.post('/', createOrderValidation, EnhancedOrderController.createOrder);
router.post('/bulk', OrderController.createBulkOrders);

router.put('/:id', updateOrderValidation, OrderController.updateOrder);
router.patch('/:id/cancel', EnhancedOrderController.cancelOrder); // 🔥 I OVU
router.patch('/:id/fill', OrderController.fillOrder);

router.delete('/:id', OrderController.deleteOrder);

// ===== NOVE TRADING RUTE =====
router.get('/orderbook/:pair', EnhancedOrderController.getOrderBook);
router.get('/trades/:pair', EnhancedOrderController.getRecentTrades);
router.get('/market/:pair', EnhancedOrderController.getMarketData);
router.get('/active-pairs', EnhancedOrderController.getActivePairs);

export default router;