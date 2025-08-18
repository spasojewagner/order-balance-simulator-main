// src/models/mongoSchemas.ts - COMPLETE DATABASE STRUCTURE

import mongoose, { Schema, Document } from 'mongoose';

// ===== INTERFACES =====

export interface IUser extends Document {
  _id: string;
  walletAddress: string;
  email?: string;
  username?: string;
  isVerified: boolean;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  preferences: {
    defaultTradingPair: string;
    notifications: boolean;
    darkMode: boolean;
  };
}

export interface IOrder extends Document {
  _id: string;
  orderNo: string; // Human-readable order number
  userId: string; // Reference to User
  walletAddress: string;
  pair: string; // e.g., "BTC/USDT"
  tokenA: string; // Base token address
  tokenB: string; // Quote token address
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop-loss' | 'take-profit';
  price: number; // Price per unit
  amount: number; // Amount of base token
  filledAmount: number; // Amount already filled
  remainingAmount: number; // Amount remaining to fill
  status: 'pending' | 'partially_filled' | 'filled' | 'cancelled' | 'expired';
  timeInForce: 'GTC' | 'IOC' | 'FOK'; // Good Till Cancel, Immediate or Cancel, Fill or Kill
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  expiresAt?: Date;
  
  // Blockchain data
  signature?: string; // User's signature for the order
  onChainTxHash?: string; // Transaction hash when executed on-chain
  blockNumber?: number;
  gasUsed?: number;
  
  // Trading data
  averageFillPrice?: number;
  totalFee: number;
  feeToken: string;
  
  // Metadata
  source: 'web' | 'api' | 'mobile';
  ipAddress?: string;
}

export interface ITrade extends Document {
  _id: string;
  tradeId: string; // Unique trade identifier
  pair: string;
  tokenA: string;
  tokenB: string;
  
  // Order references
  buyOrderId: string;
  sellOrderId: string;
  buyerWallet: string;
  sellerWallet: string;
  
  // Trade details
  price: number;
  amount: number; // Amount of base token traded
  value: number; // Total value in quote token
  
  // Fees
  buyerFee: number;
  sellerFee: number;
  feeToken: string;
  
  // Execution details
  executedAt: Date;
  executionType: 'off-chain' | 'on-chain' | 'hybrid';
  
  // Blockchain data
  onChainTxHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  gasPrice?: number;
  
  // Settlement status
  settlementStatus: 'pending' | 'confirmed' | 'failed';
  settlementAttempts: number;
  lastSettlementAttempt?: Date;
  settlementError?: string;
}

export interface IBalance extends Document {
  _id: string;
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  
  // Balance types
  availableBalance: number; // Available for trading
  lockedBalance: number; // Locked in pending orders
  dexBalance: number; // Balance in DEX smart contract
  walletBalance: number; // Balance in user's wallet
  
  // Update tracking
  lastUpdated: Date;
  lastSyncedBlock?: number;
  version: number; // For optimistic locking
  
  // Metadata
  decimals: number;
  isActive: boolean;
}

export interface ITransaction extends Document {
  _id: string;
  txHash: string;
  walletAddress: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'approval';
  
  // Transaction details
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  fee?: number;
  
  // Blockchain data
  blockNumber: number;
  blockHash: string;
  gasUsed: number;
  gasPrice: number;
  nonce: number;
  
  // Status tracking
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  
  // References
  orderId?: string; // If related to an order
  tradeId?: string; // If related to a trade
  
  // Timestamps
  createdAt: Date;
  confirmedAt?: Date;
  
  // Metadata
  network: string;
  fromAddress: string;
  toAddress: string;
}

export interface IOrderBook extends Document {
  _id: string;
  pair: string;
  tokenA: string;
  tokenB: string;
  
  // Order book data
  bids: Array<{
    price: number;
    amount: number;
    orders: number; // Number of orders at this price level
    total: number; // Cumulative total
  }>;
  
  asks: Array<{
    price: number;
    amount: number;
    orders: number;
    total: number;
  }>;
  
  // Market data
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  
  // Spread data
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;
  
  // Update tracking
  lastUpdated: Date;
  version: number;
}

export interface IAuditLog extends Document {
  _id: string;
  userId?: string;
  walletAddress?: string;
  action: string; // e.g., 'order_placed', 'trade_executed', 'withdrawal_requested'
  details: any; // JSON object with action-specific details
  
  // Request data
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  
  // Result
  success: boolean;
  errorMessage?: string;
  
  // References
  orderId?: string;
  tradeId?: string;
  txHash?: string;
}

export interface ISystemConfig extends Document {
  _id: string;
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
  updatedBy: string;
}

// ===== MONGOOSE SCHEMAS =====

const UserSchema = new Schema<IUser>({
  walletAddress: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    index: true 
  },
  email: { 
    type: String, 
    sparse: true,
    lowercase: true 
  },
  username: { 
    type: String, 
    sparse: true 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  kycStatus: { 
    type: String, 
    enum: ['none', 'pending', 'approved', 'rejected'], 
    default: 'none' 
  },
  lastActiveAt: { 
    type: Date, 
    default: Date.now 
  },
  preferences: {
    defaultTradingPair: { type: String, default: 'BTC/USDT' },
    notifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'users'
});

const OrderSchema = new Schema<IOrder>({
  orderNo: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  walletAddress: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  pair: { 
    type: String, 
    required: true,
    index: true 
  },
  tokenA: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  tokenB: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  side: { 
    type: String, 
    enum: ['buy', 'sell'], 
    required: true,
    index: true 
  },
  type: { 
    type: String, 
    enum: ['market', 'limit', 'stop-loss', 'take-profit'], 
    required: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: 0 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  filledAmount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  remainingAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  status: { 
    type: String, 
    enum: ['pending', 'partially_filled', 'filled', 'cancelled', 'expired'], 
    default: 'pending',
    index: true 
  },
  timeInForce: { 
    type: String, 
    enum: ['GTC', 'IOC', 'FOK'], 
    default: 'GTC' 
  },
  filledAt: Date,
  cancelledAt: Date,
  expiresAt: Date,
  signature: String,
  onChainTxHash: { 
    type: String,
    sparse: true,
    index: true 
  },
  blockNumber: Number,
  gasUsed: Number,
  averageFillPrice: Number,
  totalFee: { 
    type: Number, 
    default: 0 
  },
  feeToken: { 
    type: String, 
    default: 'USDT' 
  },
  source: { 
    type: String, 
    enum: ['web', 'api', 'mobile'], 
    default: 'web' 
  },
  ipAddress: String
}, {
  timestamps: true,
  collection: 'orders'
});

const TradeSchema = new Schema<ITrade>({
  tradeId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  pair: { 
    type: String, 
    required: true,
    index: true 
  },
  tokenA: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  tokenB: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  buyOrderId: { 
    type: String, 
    required: true,
    index: true 
  },
  sellOrderId: { 
    type: String, 
    required: true,
    index: true 
  },
  buyerWallet: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  sellerWallet: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: 0 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  value: { 
    type: Number, 
    required: true,
    min: 0 
  },
  buyerFee: { 
    type: Number, 
    default: 0 
  },
  sellerFee: { 
    type: Number, 
    default: 0 
  },
  feeToken: { 
    type: String, 
    default: 'USDT' 
  },
  executedAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  executionType: { 
    type: String, 
    enum: ['off-chain', 'on-chain', 'hybrid'], 
    default: 'hybrid' 
  },
  onChainTxHash: { 
    type: String,
    sparse: true,
    index: true 
  },
  blockNumber: Number,
  gasUsed: Number,
  gasPrice: Number,
  settlementStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'failed'], 
    default: 'pending',
    index: true 
  },
  settlementAttempts: { 
    type: Number, 
    default: 0 
  },
  lastSettlementAttempt: Date,
  settlementError: String
}, {
  timestamps: true,
  collection: 'trades'
});

const BalanceSchema = new Schema<IBalance>({
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  walletAddress: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  tokenAddress: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  tokenSymbol: { 
    type: String, 
    required: true,
    uppercase: true,
    index: true 
  },
  availableBalance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0 
  },
  lockedBalance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0 
  },
  dexBalance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0 
  },
  walletBalance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  lastSyncedBlock: Number,
  version: { 
    type: Number, 
    default: 1 
  },
  decimals: { 
    type: Number, 
    required: true,
    default: 18 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true,
  collection: 'balances'
});

const TransactionSchema = new Schema<ITransaction>({
  txHash: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    index: true 
  },
  walletAddress: { 
    type: String, 
    required: true,
    lowercase: true,
    index: true 
  },
  type: { 
    type: String, 
    enum: ['deposit', 'withdrawal', 'trade', 'fee', 'approval'], 
    required: true,
    index: true 
  },
  tokenAddress: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  tokenSymbol: { 
    type: String, 
    required: true,
    uppercase: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  fee: Number,
  blockNumber: { 
    type: Number, 
    required: true,
    index: true 
  },
  blockHash: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  gasUsed: { 
    type: Number, 
    required: true 
  },
  gasPrice: { 
    type: Number, 
    required: true 
  },
  nonce: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'failed'], 
    default: 'pending',
    index: true 
  },
  confirmations: { 
    type: Number, 
    default: 0 
  },
  orderId: { 
    type: String,
    sparse: true,
    index: true 
  },
  tradeId: { 
    type: String,
    sparse: true,
    index: true 
  },
  confirmedAt: Date,
  network: { 
    type: String, 
    required: true 
  },
  fromAddress: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  toAddress: { 
    type: String, 
    required: true,
    lowercase: true 
  }
}, {
  timestamps: true,
  collection: 'transactions'
});

const OrderBookSchema = new Schema<IOrderBook>({
  pair: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  tokenA: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  tokenB: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  bids: [{
    price: { type: Number, required: true },
    amount: { type: Number, required: true },
    orders: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  asks: [{
    price: { type: Number, required: true },
    amount: { type: Number, required: true },
    orders: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  lastPrice: { 
    type: Number, 
    default: 0 
  },
  priceChange24h: { 
    type: Number, 
    default: 0 
  },
  priceChangePercent24h: { 
    type: Number, 
    default: 0 
  },
  high24h: { 
    type: Number, 
    default: 0 
  },
  low24h: { 
    type: Number, 
    default: 0 
  },
  volume24h: { 
    type: Number, 
    default: 0 
  },
  bestBid: { 
    type: Number, 
    default: 0 
  },
  bestAsk: { 
    type: Number, 
    default: 0 
  },
  spread: { 
    type: Number, 
    default: 0 
  },
  spreadPercent: { 
    type: Number, 
    default: 0 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  version: { 
    type: Number, 
    default: 1 
  }
}, {
  timestamps: true,
  collection: 'orderbooks'
});

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { 
    type: String,
    sparse: true,
    index: true 
  },
  walletAddress: { 
    type: String,
    sparse: true,
    lowercase: true,
    index: true 
  },
  action: { 
    type: String, 
    required: true,
    index: true 
  },
  details: Schema.Types.Mixed,
  ipAddress: { 
    type: String, 
    required: true 
  },
  userAgent: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  success: { 
    type: Boolean, 
    required: true,
    index: true 
  },
  errorMessage: String,
  orderId: { 
    type: String,
    sparse: true,
    index: true 
  },
  tradeId: { 
    type: String,
    sparse: true,
    index: true 
  },
  txHash: { 
    type: String,
    sparse: true,
    lowercase: true,
    index: true 
  }
}, {
  timestamps: false,
  collection: 'audit_logs'
});

const SystemConfigSchema = new Schema<ISystemConfig>({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  value: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  description: String,
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedBy: { 
    type: String, 
    required: true 
  }
}, {
  collection: 'system_config'
});

// ===== INDEXES =====

// Compound indexes for better query performance
OrderSchema.index({ walletAddress: 1, status: 1, createdAt: -1 });
OrderSchema.index({ pair: 1, side: 1, price: 1, createdAt: 1 });
OrderSchema.index({ status: 1, expiresAt: 1 });

TradeSchema.index({ pair: 1, executedAt: -1 });
TradeSchema.index({ buyerWallet: 1, executedAt: -1 });
TradeSchema.index({ sellerWallet: 1, executedAt: -1 });

BalanceSchema.index({ walletAddress: 1, tokenAddress: 1 }, { unique: true });

TransactionSchema.index({ walletAddress: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, createdAt: -1 });

AuditLogSchema.index({ walletAddress: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });

// ===== MODELS =====

export const User = mongoose.model<IUser>('User', UserSchema);
export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
export const Balance = mongoose.model<IBalance>('Balance', BalanceSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export const OrderBook = mongoose.model<IOrderBook>('OrderBook', OrderBookSchema);
export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

// ===== HELPER FUNCTIONS =====

export async function createUser(walletAddress: string): Promise<IUser> {
  const user = new User({
    walletAddress: walletAddress.toLowerCase()
  });
  return await user.save();
}

export async function generateOrderNumber(): Promise<string> {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

export async function generateTradeId(): Promise<string> {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRD-${timestamp}-${random}`;
}