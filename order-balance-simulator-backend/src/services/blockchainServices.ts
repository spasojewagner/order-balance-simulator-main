// backend/src/services/blockchainService.ts - MOCK MODE FIX

import { ethers, Contract, Wallet } from 'ethers';

interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  networkId: number;
  gasLimit: number;
  mockMode: boolean; // 🆕 DODANO
}

interface TransactionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  error?: string;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;
  private dexContract: Contract | null = null;
  private config: BlockchainConfig;
  private isInitialized: boolean = false;
  private mockMode: boolean;

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.mockMode = config.mockMode || this.isInvalidPrivateKey(config.privateKey);
    
    if (this.mockMode) {
      console.log('🎭 Blockchain service running in MOCK MODE');
    }
  }

  /**
   * Check if private key is invalid/placeholder
   */
  private isInvalidPrivateKey(privateKey: string): boolean {
    return !privateKey || 
           privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
           privateKey.length !== 66 ||
           !privateKey.startsWith('0x');
  }

  /**
   * Initialize blockchain service
   */
  async initialize(): Promise<void> {
    try {
      if (this.mockMode) {
        console.log('✅ Blockchain service initialized in MOCK MODE');
        this.isInitialized = true;
        return;
      }

      // Real blockchain initialization
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      
      // Test connection
      const network = await this.provider.getNetwork();
      const balance = await this.wallet.provider?.getBalance(this.wallet.address);
      
      console.log(`🔗 Blockchain service initialized:`);
      console.log(`   Network: ${network.name} (${network.chainId})`);
      console.log(`   Wallet: ${this.wallet.address}`);
      console.log(`   Balance: ${ethers.formatEther(balance || 0)} ETH`);

      this.isInitialized = true;
      console.log('✅ Blockchain service ready');

    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      console.log('🎭 Falling back to MOCK MODE');
      this.mockMode = true;
      this.isInitialized = true;
    }
  }

  /**
   * Execute matched trade on blockchain
   */
  async executeTradeOnChain(trade: any): Promise<TransactionResult> {
    if (!this.isInitialized) {
      throw new Error('Blockchain service not initialized');
    }

    if (this.mockMode) {
      console.log(`🎭 MOCK: Executing trade on-chain: ${trade.tradeId}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        txHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        gasUsed: Math.floor(Math.random() * 100000) + 21000
      };
    }

    try {
      // Real blockchain execution would go here
      console.log(`🔗 Executing trade on-chain: ${trade.tradeId}`);
      
      // For now, return mock response
      return {
        success: true,
        txHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        gasUsed: 50000
      };

    } catch (error: any) {
      console.error('❌ Blockchain execution failed:', error);
      
      return {
        success: false,
        error: this.parseError(error)
      };
    }
  }

  /**
   * Get user balance from DEX contract
   */
  async getUserBalance(userAddress: string, tokenAddress: string): Promise<string> {
    if (this.mockMode) {
      // Return mock balance
      return (Math.random() * 1000).toFixed(4);
    }

    try {
      // Real balance check would go here
      return '0';
    } catch (error) {
      console.error('❌ Failed to get user balance:', error);
      return '0';
    }
  }

  /**
   * Monitor pending transactions
   */
  async monitorTransaction(txHash: string): Promise<TransactionResult> {
    if (this.mockMode) {
      console.log(`🎭 MOCK: Monitoring transaction: ${txHash}`);
      
      // Simulate random success/failure
      const success = Math.random() > 0.1; // 90% success rate
      
      return {
        success,
        txHash,
        blockNumber: success ? Math.floor(Math.random() * 1000000) + 18000000 : undefined,
        gasUsed: success ? Math.floor(Math.random() * 100000) + 21000 : undefined,
        error: success ? undefined : 'Mock transaction failed'
      };
    }

    try {
      // Real transaction monitoring would go here
      return {
        success: true,
        txHash,
        blockNumber: 18000000,
        gasUsed: 21000
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.parseError(error)
      };
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    if (this.mockMode) {
      return ethers.parseUnits('20', 'gwei'); // Mock 20 gwei
    }

    try {
      if (this.provider) {
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      }
      return ethers.parseUnits('20', 'gwei');
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      return ethers.parseUnits('20', 'gwei');
    }
  }

  /**
   * Estimate gas for trade execution
   */
  async estimateTradeGas(trade: any): Promise<number> {
    if (this.mockMode) {
      return Math.floor(Math.random() * 100000) + 50000; // Mock gas estimate
    }

    try {
      // Real gas estimation would go here
      return this.config.gasLimit;
    } catch (error) {
      console.error('❌ Gas estimation failed:', error);
      return this.config.gasLimit;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners(callback: (event: any) => void): void {
    if (this.mockMode) {
      console.log('🎭 MOCK: Event listeners setup');
      
      // Simulate random events
      setInterval(() => {
        if (Math.random() > 0.95) { // 5% chance every interval
          callback({
            type: 'TradeExecuted',
            data: {
              tradeId: `mock-trade-${Date.now()}`,
              buyer: '0x1234567890123456789012345678901234567890',
              seller: '0x0987654321098765432109876543210987654321',
              txHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
              blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
              timestamp: new Date()
            }
          });
        }
      }, 10000); // Every 10 seconds
      
      return;
    }

    // Real event listeners would go here
    console.log('👂 Event listeners setup for DEX contract');
  }

  /**
   * Parse blockchain errors
   */
  private parseError(error: any): string {
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for gas fees';
    }
    
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return 'Transaction would fail - check token balances and approvals';
    }
    
    return error.message || 'Unknown blockchain error';
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; blockNumber?: number; error?: string }> {
    if (this.mockMode) {
      return {
        healthy: true,
        latency: Math.floor(Math.random() * 100) + 20,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000
      };
    }

    try {
      const startTime = Date.now();
      
      if (this.provider) {
        const blockNumber = await this.provider.getBlockNumber();
        const latency = Date.now() - startTime;

        return {
          healthy: true,
          latency,
          blockNumber
        };
      }

      return {
        healthy: false,
        error: 'Provider not initialized'
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Configuration from environment variables
const blockchainConfig: BlockchainConfig = {
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
  contractAddress: process.env.DEX_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  networkId: parseInt(process.env.BLOCKCHAIN_NETWORK_ID || '1'),
  gasLimit: parseInt(process.env.DEFAULT_GAS_LIMIT || '300000'),
  mockMode: process.env.MOCK_BLOCKCHAIN === 'true' // 🆕 DODANO
};

// Singleton instance
export const blockchainService = new BlockchainService(blockchainConfig);

// Export types
export type { TransactionResult, BlockchainConfig };