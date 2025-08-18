// backend/src/routes/blockchainRoutes.ts - BLOCKCHAIN API ENDPOINTS

import { Router, Request, Response } from 'express';
import { blockchainService } from '../services/blockchainServices';
import { tradingService } from '../services/tradingServices';
import { body, param, validationResult } from 'express-validator';

const router = Router();

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

// ===== BLOCKCHAIN STATUS =====

/**
 * GET /api/blockchain/status
 * Get blockchain service health status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const health = await blockchainService.healthCheck();
    
    res.json({
      success: true,
      data: {
        healthy: health.healthy,
        latency: health.latency,
        blockNumber: health.blockNumber,
        timestamp: new Date().toISOString(),
        error: health.error
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain status',
      error: error.message
    });
  }
});

// ===== BALANCE OPERATIONS =====

/**
 * GET /api/blockchain/balance/:userAddress/:tokenAddress
 * Get user's DEX balance for specific token
 */
router.get('/balance/:userAddress/:tokenAddress',
  [
    param('userAddress').isEthereumAddress().withMessage('Invalid user address'),
    param('tokenAddress').isEthereumAddress().withMessage('Invalid token address')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { userAddress, tokenAddress } = req.params;
      
      const balance = await blockchainService.getUserBalance(userAddress, tokenAddress);
      
      res.json({
        success: true,
        data: {
          userAddress,
          tokenAddress,
          balance,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to get balance',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/blockchain/balances/:userAddress
 * Get user's DEX balances for multiple tokens
 */
router.post('/balances/:userAddress',
  [
    param('userAddress').isEthereumAddress().withMessage('Invalid user address'),
    body('tokens').isArray().withMessage('Tokens must be an array'),
    body('tokens.*').isEthereumAddress().withMessage('Invalid token address')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { tokens } = req.body;
      
      const balances = await Promise.all(
        tokens.map(async (tokenAddress: string) => {
          const balance = await blockchainService.getUserBalance(userAddress, tokenAddress);
          return {
            tokenAddress,
            balance
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          userAddress,
          balances,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to get balances',
        error: error.message
      });
    }
  }
);

// ===== TRADE EXECUTION =====

/**
 * POST /api/blockchain/execute-trade
 * Execute a matched trade on blockchain
 */
router.post('/execute-trade',
  [
    body('tradeId').notEmpty().withMessage('Trade ID is required'),
    body('buyOrderId').notEmpty().withMessage('Buy order ID is required'),
    body('sellOrderId').notEmpty().withMessage('Sell order ID is required'),
    body('buyerAddress').isEthereumAddress().withMessage('Invalid buyer address'),
    body('sellerAddress').isEthereumAddress().withMessage('Invalid seller address'),
    body('tokenA').isEthereumAddress().withMessage('Invalid token A address'),
    body('tokenB').isEthereumAddress().withMessage('Invalid token B address'),
    body('amountA').isDecimal().withMessage('Invalid amount A'),
    body('amountB').isDecimal().withMessage('Invalid amount B'),
    body('price').isDecimal().withMessage('Invalid price')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const tradeData = req.body;
      
      console.log(`🎯 Executing trade via API: ${tradeData.tradeId}`);
      
      // Execute trade on blockchain
      const result = await blockchainService.executeTradeOnChain(tradeData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Trade executed successfully',
          data: {
            tradeId: tradeData.tradeId,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Trade execution failed',
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to execute trade',
        error: error.message
      });
    }
  }
);

// ===== GAS ESTIMATION =====

/**
 * POST /api/blockchain/estimate-gas
 * Estimate gas for trade execution
 */
router.post('/estimate-gas',
  [
    body('tradeId').notEmpty().withMessage('Trade ID is required'),
    body('buyerAddress').isEthereumAddress().withMessage('Invalid buyer address'),
    body('sellerAddress').isEthereumAddress().withMessage('Invalid seller address'),
    body('tokenA').isEthereumAddress().withMessage('Invalid token A address'),
    body('tokenB').isEthereumAddress().withMessage('Invalid token B address'),
    body('amountA').isDecimal().withMessage('Invalid amount A'),
    body('amountB').isDecimal().withMessage('Invalid amount B')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const tradeData = req.body;
      
      const gasEstimate = await blockchainService.estimateTradeGas(tradeData);
      const gasPrice = await blockchainService.getGasPrice();
      
      const estimatedCost = Number(gasEstimate) * Number(gasPrice) / 1e18; // Convert to ETH
      
      res.json({
        success: true,
        data: {
          gasEstimate,
          gasPrice: gasPrice.toString(),
          estimatedCostETH: estimatedCost.toFixed(6),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to estimate gas',
        error: error.message
      });
    }
  }
);

// ===== TRANSACTION MONITORING =====

/**
 * GET /api/blockchain/transaction/:txHash
 * Monitor transaction status
 */
router.get('/transaction/:txHash',
  [
    param('txHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { txHash } = req.params;
      
      const result = await blockchainService.monitorTransaction(txHash);
      
      res.json({
        success: true,
        data: {
          txHash,
          confirmed: result.success,
          blockNumber: result.blockNumber,
          gasUsed: result.gasUsed,
          error: result.error,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to monitor transaction',
        error: error.message
      });
    }
  }
);

export default router;

