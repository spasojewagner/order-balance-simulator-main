// order-balance-simulator-backend/src/routes/orderRoutes.ts - FINAL FIXED VERSION

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';

const router = Router();

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

// 🔧 KOMPLETNO NOVA VALIDACIJA
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

  // 🔧 KRITIČNA ISPRAVKA: Price validation
  body('price')
    .custom((value, { req }) => {
      const orderType = req.body.type;
      
      console.log(`🔍 Validating price: "${value}" (type: ${typeof value}) for order: ${orderType}`);

      // Za Market orders - price može biti bilo šta, ignorišemo ga
      if (orderType === 'Market Buy' || orderType === 'Market Sell') {
        console.log('✅ Market order - price validation skipped');
        return true; // Uvek prošlemo validaciju za market orders
      }

      // Za Limit orders - price je obavezan i mora biti pozitivan
      if (orderType === 'Limit Buy' || orderType === 'Limit Sell') {
        if (value === undefined || value === null || value === '') {
          throw new Error('Price is required for limit orders');
        }
        
        const numValue = Number(value);
        if (isNaN(numValue) || numValue <= 0) {
          throw new Error('Price must be a positive number for limit orders');
        }
        
        console.log('✅ Limit order price validation passed:', numValue);
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

// ===== KOMPLETNO NOVA CREATE ORDER LOGIKA =====
router.post('/', createOrderValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const orderData = req.body;

    console.log('📝 Raw order data received:', JSON.stringify(orderData, null, 2));

    // 🔧 KRITIČNA ISPRAVKA: Jednostavna logika za price
    let finalPrice: number | undefined = undefined;

    // Samo za Limit orders uzimamo cenu iz zahteva
    if (orderData.type === 'Limit Buy' || orderData.type === 'Limit Sell') {
      const numPrice = Number(orderData.price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid price for limit order'
        });
      }
      finalPrice = numPrice;
      console.log('💰 Limit order - using provided price:', finalPrice);
    } else {
      // Za Market orders - price ostaje undefined
      // Trading service će sam da odredi market cenu
      console.log('📈 Market order - price will be determined by market');
    }

    // Kreiraj order objekat za bazu
    const dbOrder = {
      pair: orderData.pair?.toUpperCase(),
      type: orderData.type,
      price: finalPrice, // undefined za market, broj za limit
      amount: Number(orderData.amount),
      walletAddress: orderData.walletAddress,
      status: 'Pending'
    };

    console.log('💾 Order for database:', JSON.stringify(dbOrder, null, 2));

    // Pozovi trading service
    const result = await tradingService.placeOrder(dbOrder);

    if (result.success) {
      console.log('✅ Order placed successfully:', result.data);

      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message || 'Order created successfully',
        trades: result.data?.trades || []
      });
    } else {
      console.error('❌ Trading service error:', result);
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to place order',
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('❌ Route error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===== OSTALE RUTE (POSTOJEĆE) =====
router.get('/orderbook/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const orderBook = tradingService.getOrderBook(pair.toUpperCase());
    res.json({ success: true, data: orderBook });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/trades/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const { limit = 50 } = req.query;
    const trades = tradingService.getRecentTrades(pair.toUpperCase(), Number(limit));
    res.json({ success: true, data: trades });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', OrderController.getAllOrders);
router.get('/stats/summary', OrderController.getOrdersSummary);
router.get('/stats/volume/:pair', OrderController.getVolumeStats);
router.get('/number/:no', OrderController.getOrderByNumber);
router.get('/:id', OrderController.getOrderById);
router.put('/:id', OrderController.updateOrder);

router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await tradingService.cancelOrder(id, req.body.pair);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/fill', OrderController.fillOrder);
router.delete('/:id', OrderController.deleteOrder);

router.get('/market/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const marketData = tradingService.getMarketData(pair.toUpperCase());
    res.json({ success: true, data: marketData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/pairs', async (req: Request, res: Response) => {
  try {
    const pairs = tradingService.getActivePairs();
    res.json({ success: true, data: pairs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;