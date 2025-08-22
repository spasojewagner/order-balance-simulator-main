// src/@types/index.ts - Updated ISymbol interface with missing properties

export interface ISymbol {
  id: string; // Added missing id property
  symbol: string;
  coinA: string;
  coinB: string;
  price?: number;
  current_price?: number; // Added missing current_price property
  change?: number;
  volume?: number;
  
  // Blockchain Integration Properties
  tokenAAddress?: string;
  tokenBAddress?: string;
  tokenADecimals?: number;
  tokenBDecimals?: number;
  
  // Network specific addresses
  addresses?: {
    [networkId: number]: {
      tokenA: string;
      tokenB: string;
    };
  };
  
  // Trading pair metadata
  pairAddress?: string;
  liquidityPoolAddress?: string;
  
  // Display properties
  displayName?: string;
  icon?: string;
  category?: 'major' | 'stable' | 'defi' | 'altcoin';
  
  // Trading properties
  minTradeAmount?: number;
  maxTradeAmount?: number;
  tradingEnabled?: boolean;
}

// Order related types
export interface IOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  
  // Blockchain integration
  userAddress?: string;
  signature?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  
  // Order matching
  matchedOrders?: string[];
  remainingQuantity?: number;
  filledQuantity?: number;
}

// Trading pair configuration
export interface ITradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  baseAddress: string;
  quoteAddress: string;
  
  // Network specific configurations
  networks: {
    [networkId: number]: {
      baseAddress: string;
      quoteAddress: string;
      pairAddress?: string;
      liquidityPool?: string;
      enabled: boolean;
    };
  };
  
  // Trading parameters
  minOrderSize: number;
  maxOrderSize: number;
  priceStep: number;
  quantityStep: number;
  
  // Market data
  lastPrice?: number;
  volume24h?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
}

// Wallet related types
export interface IWalletState {
  address: string;
  connected: boolean;
  networkId: number | null;
  networkName: string;
  balances: {
    [tokenAddress: string]: {
      balance: string;
      symbol: string;
      decimals: number;
      formatted: string;
    };
  };
  
  // Transaction history
  transactions: ITransaction[];
  
  // Pending operations
  pendingTransactions: string[];
  pendingOrders: string[];
}

export interface ITransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'deposit' | 'withdraw' | 'trade' | 'approval';
  
  // Trade specific data
  tokenA?: string;
  tokenB?: string;
  amountA?: string;
  amountB?: string;
  orderId?: string;
}

// Market data types
export interface IMarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: number;
  
  // Order book data
  bids: Array<[number, number]>; // [price, quantity]
  asks: Array<[number, number]>; // [price, quantity]
  
  // Chart data
  candlesticks?: ICandlestick[];
}

export interface ICandlestick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Network configuration
export interface INetworkConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  
  // Contract addresses
  contracts: {
    dex?: string;
    multicall?: string;
    router?: string;
    factory?: string;
  };
  
  // Supported tokens
  tokens: {
    [symbol: string]: string; // symbol -> address mapping
  };
}

// API Response types
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface IOrderBookResponse {
  symbol: string;
  bids: Array<[string, string]>; // [price, quantity] as strings
  asks: Array<[string, string]>; // [price, quantity] as strings
  timestamp: number;
}

export interface ITradeHistoryResponse {
  trades: Array<{
    id: string;
    symbol: string;
    price: string;
    quantity: string;
    side: 'buy' | 'sell';
    timestamp: number;
    maker: boolean;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

// Component prop types
export interface IWalletConnectProps {
  onConnect?: (address: string, networkId: number) => void;
  onDisconnect?: () => void;
  onNetworkChange?: (networkId: number) => void;
  showBalance?: boolean;
  showNetwork?: boolean;
}

export interface ITradingFormProps {
  symbol: ISymbol;
  orderType: 'buy' | 'sell';
  onOrderSubmit: (order: Partial<IOrder>) => void;
  walletConnected: boolean;
  availableBalance: number;
}

export interface IOrderBookProps {
  symbol: string;
  orders: IOrder[];
  onOrderClick?: (order: IOrder) => void;
  maxDepth?: number;
}

// Error types
export class WalletError extends Error {
  code?: number;
  data?: any;
  
  constructor(message: string, code?: number, data?: any) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.data = data;
  }
}

export class TradingError extends Error {
  orderId?: string;
  symbol?: string;
  
  constructor(message: string, orderId?: string, symbol?: string) {
    super(message);
    this.name = 'TradingError';
    this.orderId = orderId;
    this.symbol = symbol;
  }
}

// Utility types
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'partial';
export type TradingMode = 'off-chain' | 'on-chain' | 'hybrid';
export type NetworkId = 1 | 5 | 11155111 | 137 | 80001; // Supported networks

// Constants
export const SUPPORTED_NETWORKS: NetworkId[] = [1, 5, 11155111, 137, 80001];
export const DEFAULT_DECIMALS = 18;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Export all types as default
export default {
  ISymbol,
  IOrder,
  ITradingPair,
  IWalletState,
  ITransaction,
  IMarketData,
  ICandlestick,
  INetworkConfig,
  IApiResponse,
  IOrderBookResponse,
  ITradeHistoryResponse,
  WalletError,
  TradingError
};