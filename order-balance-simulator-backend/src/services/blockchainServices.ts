// services/blockchainService.ts - Add this new file
import { ethers, Contract, Wallet } from 'ethers';
import { IOrder } from '../models/orderModel';

interface Trade {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  amount: number;
  timestamp: Date;
  pair: string;
}

interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  gasLimit: number;
}

// Smart contract ABI for DEX trading
const DEX_ABI = [
  "function executeTrade(address buyer, address seller, string memory pair, uint256 amount, uint256 price) external returns (bytes32)",
  "function updateBalance(address user, string memory token, uint256 amount, bool isAdd) external",
  "function getBalance(address user, string memory token) external view returns (uint256)",
  "event TradeExecuted(bytes32 indexed tradeId, address buyer, address seller, string pair, uint256 amount, uint256 price)"
];

export class BlockchainService {
  private provider: ethers.Provider;
  private wallet: Wallet;
  private contract: Contract;
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(
      config.contractAddress,
      DEX_ABI,
      this.wallet
    );
  }

  /**
   * Execute a matched trade on-chain
   */
  async executeTrade(trade: Trade, buyOrder: IOrder, sellOrder: IOrder): Promise<{
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    try {
      console.log(`🔗 Executing on-chain trade: ${trade.amount} ${trade.pair} @ ${trade.price}`);

      // Convert to blockchain units (assuming 18 decimals)
      const amountWei = ethers.parseUnits(trade.amount.toString(), 18);
      const priceWei = ethers.parseUnits(trade.price.toString(), 18);

      // Execute the trade on smart contract
      const tx = await this.contract.executeTrade(
        buyOrder._id.toString(), // buyer address (using order ID as proxy)
        sellOrder._id.toString(), // seller address
        trade.pair,
        amountWei,
        priceWei,
        {
          gasLimit: this.config.gasLimit,
          // gasPrice can be estimated automatically
        }
      );

      console.log(`⏳ Transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(1); // Wait for 1 confirmation

      console.log(`✅ Trade executed on-chain: Block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error: any) {
      console.error('❌ Blockchain execution failed:', error);
      
      return {
        success: false,
        error: error.message || 'Unknown blockchain error'
      };
    }
  }

  /**
   * Update user balance on-chain
   */
  async updateUserBalance(
    userAddress: string, 
    token: string, 
    amount: number, 
    isCredit: boolean
  ): Promise<boolean> {
    try {
      const amountWei = ethers.parseUnits(amount.toString(), 18);
      
      const tx = await this.contract.updateBalance(
        userAddress,
        token,
        amountWei,
        isCredit,
        { gasLimit: this.config.gasLimit }
      );

      await tx.wait(1);
      console.log(`💰 Balance updated on-chain: ${isCredit ? '+' : '-'}${amount} ${token}`);
      return true;

    } catch (error) {
      console.error('❌ Balance update failed:', error);
      return false;
    }
  }

  /**
   * Get user balance from blockchain
   */
  async getUserBalance(userAddress: string, token: string): Promise<number> {
    try {
      const balanceWei = await this.contract.getBalance(userAddress, token);
      const balance = parseFloat(ethers.formatUnits(balanceWei, 18));
      return balance;
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Verify transaction on blockchain
   */
  async verifyTransaction(txHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: number;
    gasUsed?: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { confirmed: false };
      }

      return {
        confirmed: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      console.error('❌ Transaction verification failed:', error);
      return { confirmed: false };
    }
  }

  /**
   * Estimate gas for a trade
   */
  async estimateGas(trade: Trade): Promise<number> {
    try {
      const amountWei = ethers.parseUnits(trade.amount.toString(), 18);
      const priceWei = ethers.parseUnits(trade.price.toString(), 18);

      const gasEstimate = await this.contract.executeTrade.estimateGas(
        trade.buyOrderId,
        trade.sellOrderId,
        trade.pair,
        amountWei,
        priceWei
      );

      return Number(gasEstimate);
    } catch (error) {
      console.error('❌ Gas estimation failed:', error);
      return this.config.gasLimit; // Fallback to default
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      return ethers.parseUnits('20', 'gwei'); // Default 20 gwei
    }
  }
}

// Configuration
const blockchainConfig: BlockchainConfig = {
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY',
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '0x...',
  contractAddress: process.env.DEX_CONTRACT_ADDRESS || '0x...',
  gasLimit: parseInt(process.env.GAS_LIMIT || '300000')
};

// Singleton instance
export const blockchainService = new BlockchainService(blockchainConfig);

// Enhanced Trade Model for storing blockchain data
export interface BlockchainTrade extends Trade {
  txHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  confirmed: boolean;
  executionError?: string;
}