// order-balance-simulator-backend/src/services/blockchainServices.ts

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Jednostavan ABI za naš contract
const DEX_ABI = [
  "function executeTrade(string memory _tradeId, address _buyer, address _seller, uint256 _amount, uint256 _price) external",
  "function getTrade(string memory _tradeId) external view returns (tuple(string tradeId, address buyer, address seller, uint256 amount, uint256 price, uint256 timestamp, bool executed))",
  "function totalTradesExecuted() external view returns (uint256)",
  "event TradeExecuted(string indexed tradeId, address indexed buyer, address indexed seller, uint256 amount, uint256 price, uint256 timestamp)"
];

// Types
interface TransactionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

interface BlockchainEvent {
  type: string;
  data: any;
}

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private isInitialized = false;
  private mockMode = false;
  private eventCallbacks: ((event: BlockchainEvent) => void)[] = [];

  async initialize() {
    try {
      console.log('🔄 Initializing blockchain service...');
      
      // Check if we should use mock mode
      if (process.env.BLOCKCHAIN_MOCK_MODE === 'true') {
        console.log('🎭 Blockchain service running in MOCK MODE');
        this.mockMode = true;
        this.isInitialized = true;
        return;
      }
      
      // Konektuj se na lokalni Hardhat node
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
      console.log(`📡 Connecting to RPC: ${rpcUrl}`);
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test connection
      try {
        const network = await this.provider.getNetwork();
        console.log(`🌐 Connected to network: ${network.name} (chainId: ${network.chainId})`);
      } catch (error) {
        console.log('⚠️ Cannot connect to blockchain, using MOCK MODE');
        this.mockMode = true;
        this.isInitialized = true;
        return;
      }
      
      // Kreiraj wallet sa private key iz .env
      const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
      if (!privateKey) {
        console.log('⚠️ No private key configured, using MOCK MODE');
        this.mockMode = true;
        this.isInitialized = true;
        return;
      }
      
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`👛 Wallet address: ${this.wallet.address}`);
      
      // Konektuj se na smart contract
      const contractAddress = process.env.DEX_CONTRACT_ADDRESS;
      if (contractAddress && contractAddress !== '') {
        this.contract = new ethers.Contract(
          contractAddress,
          DEX_ABI,
          this.wallet
        );
        
        console.log('📄 Connected to contract:', contractAddress);
        
        // Proveri da li radi
        try {
          const totalTrades = await this.contract.totalTradesExecuted();
          console.log('📊 Total trades executed on-chain:', totalTrades.toString());
        } catch (error) {
          console.error('⚠️ Contract call failed:', error);
        }
      } else {
        console.log('⚠️ No contract address configured');
        this.mockMode = true;
      }
      
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH');
      
      this.isInitialized = true;
      console.log('✅ Blockchain service initialized successfully');
      
    } catch (error) {
      console.error('❌ Blockchain init failed:', error);
      console.log('📌 Running in MOCK MODE');
      this.mockMode = true;
      this.isInitialized = true;
    }
  }

  async executeTradeOnChain(tradeData: any): Promise<TransactionResult> {
    if (!this.isInitialized) {
      console.log('⚠️ Blockchain service not initialized');
      return {
        success: false,
        error: 'Blockchain service not initialized'
      };
    }

    if (this.mockMode || !this.contract) {
      console.log(`🎭 MOCK: Would execute trade on-chain: ${tradeData.tradeId}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockTxHash = '0x' + Math.random().toString(16).slice(2).padStart(64, '0');
      console.log(`🎭 MOCK: Trade executed with tx: ${mockTxHash}`);
      
      return {
        success: true,
        txHash: mockTxHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        gasUsed: '50000'
      };
    }

    try {
      console.log(`📝 Executing trade on blockchain: ${tradeData.tradeId}`);
      console.log(`   Buyer: ${tradeData.buyerAddress || 'N/A'}`);
      console.log(`   Seller: ${tradeData.sellerAddress || 'N/A'}`);
      console.log(`   Amount: ${tradeData.amount}`);
      console.log(`   Price: ${tradeData.price}`);
      
      // Execute trade on smart contract
      const tx = await this.contract.executeTrade(
        tradeData.tradeId,
        tradeData.buyerAddress || ethers.ZeroAddress,
        tradeData.sellerAddress || ethers.ZeroAddress,
        ethers.parseEther(tradeData.amount.toString()),
        ethers.parseEther(tradeData.price.toString())
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      
      console.log('✅ Trade executed on-chain!');
      console.log(`   TX Hash: ${receipt.hash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error: any) {
      console.error('❌ On-chain execution failed:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed'
      };
    }
  }

  async getUserBalance(userAddress: string, tokenAddress?: string): Promise<string> {
    if (this.mockMode || !this.provider) {
      // Return mock balance
      return (Math.random() * 1000).toFixed(4);
    }

    try {
      if (!tokenAddress || tokenAddress === 'ETH') {
        // Get ETH balance
        const balance = await this.provider.getBalance(userAddress);
        return ethers.formatEther(balance);
      } else {
        // For ERC20 tokens, would need token contract
        return '0';
      }
    } catch (error) {
      console.error('❌ Failed to get user balance:', error);
      return '0';
    }
  }

  async getWalletAddress(): Promise<string> {
    return this.wallet?.address || '0x0000000000000000000000000000000000000000';
  }

  async healthCheck() {
    const health = {
      healthy: this.isInitialized,
      mockMode: this.mockMode,
      provider: !!this.provider,
      wallet: !!this.wallet,
      contract: !!this.contract,
      contractAddress: process.env.DEX_CONTRACT_ADDRESS,
      walletAddress: this.wallet?.address,
      latency: 0,
      blockNumber: 0,
      error: null as string | null
    };

    if (this.provider && !this.mockMode) {
      try {
        const start = Date.now();
        const blockNumber = await this.provider.getBlockNumber();
        health.latency = Date.now() - start;
        health.blockNumber = blockNumber;
      } catch (error: any) {
        health.error = error.message;
        health.healthy = false;
      }
    }

    return health;
  }

  setupEventListeners(callback: (event: BlockchainEvent) => void) {
    this.eventCallbacks.push(callback);
    
    if (!this.contract || this.mockMode) {
      console.log('📌 No contract or in mock mode - skipping event listeners');
      return;
    }

    // Listen for TradeExecuted events
    this.contract.on('TradeExecuted', (tradeId, buyer, seller, amount, price, timestamp) => {
      console.log('🎉 Trade event received:', tradeId);
      
      const event: BlockchainEvent = {
        type: 'TradeExecuted',
        data: {
          tradeId,
          buyer,
          seller,
          amount: ethers.formatEther(amount),
          price: ethers.formatEther(price),
          timestamp: timestamp.toString(),
          txHash: '', // Would need to get from event
          blockNumber: 0 // Would need to get from event
        }
      };
      
      // Notify all callbacks
      this.eventCallbacks.forEach(cb => cb(event));
    });
    
    console.log('📡 Event listeners setup complete');
  }

  async monitorTransaction(txHash: string): Promise<TransactionResult> {
    if (this.mockMode || !this.provider) {
      console.log(`🎭 MOCK: Monitoring transaction: ${txHash}`);
      
      // Simulate random success/failure
      const success = Math.random() > 0.1; // 90% success rate
      
      return {
        success,
        txHash,
        blockNumber: success ? Math.floor(Math.random() * 1000000) + 18000000 : undefined,
        gasUsed: success ? Math.floor(Math.random() * 100000) + 21000 : undefined,
        error: success ? undefined : 'Transaction failed'
      };
    }

    try {
      console.log(`🔍 Monitoring transaction: ${txHash}`);
      const receipt = await this.provider.waitForTransaction(txHash);
      
      if (receipt && receipt.status === 1) {
        return {
          success: true,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        };
      } else {
        return {
          success: false,
          txHash,
          error: 'Transaction reverted'
        };
      }
    } catch (error: any) {
      console.error('❌ Failed to monitor transaction:', error);
      return {
        success: false,
        txHash,
        error: error.message
      };
    }
  }

  private parseError(error: any): string {
    if (error.reason) return error.reason;
    if (error.message) return error.message;
    if (error.error?.message) return error.error.message;
    return 'Unknown blockchain error';
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  isMockMode(): boolean {
    return this.mockMode;
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();