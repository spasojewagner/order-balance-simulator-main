// backend/src/routes/enhancedOrderRoutes.ts - FIXED ORDER CONTROLLER INTEGRATION

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { OrderController } from '../controllers/orderController';
import { tradingService } from '../services/tradingServices';

const orderRouter = Router();

// ===== MIDDLEWARE =====

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

// Mock blockchain service (replace with real one later)
const mockBlockchainService = {
  async healthCheck() {
    return {
      healthy: true,
      latency: 50,
      blockNumber: 12345,
      error: null
    };
  }
};

/**
 * POST /api/orders - Enhanced order creation with blockchain support
 */
orderRouter.post('/',
  [
    body('pair').notEmpty().withMessage('Trading pair is required'),
    body('side').isIn(['buy', 'sell']).withMessage('Side must be buy or sell'),
    body('type').isIn(['market', 'limit']).withMessage('Type must be market or limit'),
    body('amount').isDecimal({ gt: 0 }).withMessage('Amount must be positive'),
    body('price').optional().isDecimal({ gt: 0 }).withMessage('Price must be positive'),
    body('walletAddress').optional().isLength({ min: 42, max: 42 }).withMessage('Invalid wallet address'),
    body('signature').optional().isString().withMessage('Signature must be string'),
    body('tradingMode').optional().isIn(['off-chain', 'on-chain', 'hybrid']).withMessage('Invalid trading mode')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      console.log('🆕 Enhanced order creation request:', req.body);
      
      // Call existing order controller CREATE method correctly
      await OrderController.createOrder(req, res, () => {});
      
      // Note: OrderController.createOrder handles the response
      // If we reach here, it means the response was already sent
      
      // If trading mode is on-chain or hybrid, log for blockchain preparation
      if (req.body.tradingMode !== 'off-chain') {
        console.log(`🔗 Order prepared for blockchain execution with mode: ${req.body.tradingMode}`);
      }
      
    } catch (error: any) {
      console.error('❌ Enhanced order creation failed:', error);
      
      // Only send response if not already sent
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to create order',
          error: error.message
        });
      }
    }
  }
);

/**
 * GET /api/orders - Enhanced order listing
 */
orderRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Call existing order controller
    await OrderController.getAllOrders(req, res, () => {});
  } catch (error: any) {
    console.error('❌ Failed to get orders:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to get orders',
        error: error.message
      });
    }
  }
});

/**
 * GET /api/orders/market-data/:pair - Enhanced market data with blockchain info
 */
orderRouter.get('/market-data/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    
    // Get existing market data
    const marketData = tradingService.getMarketData(pair);
    
    // Add blockchain info
    const blockchainHealth = await mockBlockchainService.healthCheck();
    
    res.json({
      success: true,
      data: {
        ...marketData,
        blockchain: {
          healthy: blockchainHealth.healthy,
          latency: blockchainHealth.latency,
          blockNumber: blockchainHealth.blockNumber
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to get market data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market data',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/orderbook/:pair - Enhanced order book
 */
orderRouter.get('/orderbook/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    
    // Get order book from trading service
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
    console.error('❌ Failed to get order book:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order book',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/trades/:pair - Recent trades
 */
orderRouter.get('/trades/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Get recent trades
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
    console.error('❌ Failed to get trades:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trades',
      error: error.message
    });
  }
});

/**
 * DELETE /api/orders/:orderId - Cancel order
 */
orderRouter.delete('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { pair } = req.query;
    
    if (!pair) {
      return res.status(400).json({
        success: false,
        message: 'Trading pair is required'
      });
    }
    
    // Cancel order via trading service
    const result = await tradingService.cancelOrder(orderId, pair as string);
    
    if (result) {
      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: { orderId, pair }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Order not found or already executed'
      });
    }
  } catch (error: any) {
    console.error('❌ Failed to cancel order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

export { orderRouter };