// src/services/walletService.ts - ENHANCED WITH ORDER MANAGEMENT

import Web3 from 'web3';

// ===== TYPES & INTERFACES =====

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface NetworkInfo {
  name: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface OrderData {
  orderId: string;
  tradeId: string;
  type: 'buy' | 'sell';
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  price: number;
  quantity: number;
  counterpartyAddress?: string;
  deadline: number;
  nonce: number;
}

export interface TradeSignature {
  signature: string;
  orderData: OrderData;
  timestamp: number;
  userAddress: string;
}

// ===== CONSTANTS =====

// Network configurations
export const SUPPORTED_NETWORKS: Record<number, NetworkInfo> = {
  31337: {
    name: 'Localhost 8545',
    rpcUrl: 'http://127.0.0.1:8545',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY',
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  5: {
    name: 'Goerli Testnet', 
    rpcUrl: 'https://eth-goerli.alchemyapi.io/v2/YOUR_KEY',
    blockExplorerUrl: 'https://goerli.etherscan.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  11155111: {
    name: 'Sepolia Testnet',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY', 
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  137: {
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-mainnet.alchemyapi.io/v2/YOUR_KEY',
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  80001: {
    name: 'Mumbai Testnet',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorerUrl: 'https://mumbai.polygonscan.com', 
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  }
};

// Contract addresses
export const CONTRACT_ADDRESSES = {
  DEX_SETTLEMENT: {
    31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Your deployed contract
    1: '0x0000000000000000000000000000000000000000', // Mainnet
    5: '0x0000000000000000000000000000000000000000', // Goerli
    11155111: '0x0000000000000000000000000000000000000000', // Sepolia
    137: '0x0000000000000000000000000000000000000000', // Polygon
    80001: '0x0000000000000000000000000000000000000000' // Mumbai
  },
  TOKENS: {
    USDT: {
      31337: '0x0000000000000000000000000000000000000000', // Local mock
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT
      5: '0x0000000000000000000000000000000000000000', // Mock USDT
      11155111: '0x0000000000000000000000000000000000000000' // Mock USDT
    },
    USDC: {
      31337: '0x0000000000000000000000000000000000000000', // Local mock
      1: '0xA0b86a991c60B86a33E6417eFb1C6088D5EB6e9F83f9D0Dc8e', // Real USDC
      5: '0x0000000000000000000000000000000000000000', // Mock USDC
      11155111: '0x0000000000000000000000000000000000000000' // Mock USDC
    },
    BTC: {
      31337: '0x0000000000000000000000000000000000000000', // Local mock
      1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      5: '0x0000000000000000000000000000000000000000', // Mock BTC
      11155111: '0x0000000000000000000000000000000000000000' // Mock BTC
    }
  }
};

// ERC20 ABI (minimal)
const ERC20_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals", 
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol", 
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// DEX Contract ABI (minimal)
const DEX_CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_user", "type": "address"},
      {"internalType": "address", "name": "_token", "type": "address"}
    ],
    "name": "getBalance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// ===== WALLET SERVICE CLASS =====

export class WalletService {
  private web3: Web3 | null = null;
  private account: string | null = null;
  private networkId: number | null = null;
  private orderCounter: number = 0;

  // ===== INITIALIZATION =====

  async connect(): Promise<{
    success: boolean;
    account?: string;
    networkId?: number;
    error?: string;
  }> {
    try {
      if (!window.ethereum) {
        return { success: false, error: 'MetaMask not installed' };
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (!accounts || accounts.length === 0) {
        return { success: false, error: 'No accounts found' };
      }

      this.web3 = new Web3(window.ethereum);
      this.account = accounts[0];
      
      // Get network ID
      const chainId = await this.web3.eth.getChainId();
      this.networkId = Number(chainId);

      console.log('✅ Wallet connected:', {
        account: this.account,
        networkId: this.networkId,
        networkName: SUPPORTED_NETWORKS[this.networkId]?.name || 'Unknown'
      });

      return {
        success: true,
        account: this.account,
        networkId: this.networkId
      };

    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  disconnect(): void {
    this.web3 = null;
    this.account = null;
    this.networkId = null;
    this.orderCounter = 0;
    console.log('Wallet disconnected');
  }

  // ===== GETTERS =====

  getAccount(): string | null {
    return this.account;
  }

  getNetworkId(): number | null {
    return this.networkId;
  }

  isConnected(): boolean {
    return !!(this.web3 && this.account);
  }

  // ===== BALANCE OPERATIONS =====

  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<{
    balance: string;
    decimals: number;
    formatted: string;
  }> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    try {
      const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
      const [balance, decimals] = await Promise.all([
        contract.methods.balanceOf(account).call(),
        contract.methods.decimals().call()
      ]);

      const divisor = Math.pow(10, Number(decimals));
      const formatted = (Number(balance) / divisor).toString();

      return {
        balance: balance.toString(),
        decimals: Number(decimals),
        formatted
      };
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return { balance: '0', decimals: 18, formatted: '0' };
    }
  }

  async getETHBalance(userAddress?: string): Promise<string> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    try {
      const balanceWei = await this.web3.eth.getBalance(account);
      const balanceEth = this.web3.utils.fromWei(balanceWei, 'ether');
      return balanceEth;
    } catch (error) {
      console.error('Failed to get ETH balance:', error);
      return '0';
    }
  }

  async getDEXBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    if (!this.web3 || !this.networkId) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    const dexAddress = CONTRACT_ADDRESSES.DEX_SETTLEMENT[this.networkId as keyof typeof CONTRACT_ADDRESSES.DEX_SETTLEMENT];
    
    if (!dexAddress || dexAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('DEX contract not deployed on this network');
      return '0';
    }

    try {
      const dexContract = new this.web3.eth.Contract(DEX_CONTRACT_ABI, dexAddress);
      const balance = await dexContract.methods.getBalance(account, tokenAddress).call();
      const balanceEth = this.web3.utils.fromWei(balance, 'ether');
      return balanceEth;
    } catch (error) {
      console.error('Failed to get DEX balance:', error);
      return '0';
    }
  }

  // ===== ORDER GENERATION & VALIDATION =====

  generateOrderId(): string {
    this.orderCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ORDER_${timestamp}_${this.orderCounter}_${random}`;
  }

  generateTradeId(): string {
    return `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  }

  createOrderData(params: {
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    tokenA: string;
    tokenB: string;
    counterpartyAddress?: string;
  }): OrderData {
    const orderId = this.generateOrderId();
    const tradeId = this.generateTradeId();
    const { type, price, quantity, tokenA, tokenB, counterpartyAddress } = params;

    return {
      orderId,
      tradeId,
      type,
      tokenA: tokenA || '0x0000000000000000000000000000000000000000',
      tokenB: tokenB || '0x0000000000000000000000000000000000000000',
      amountA: quantity.toString(),
      amountB: (quantity * price).toString(),
      price,
      quantity,
      counterpartyAddress,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      nonce: Date.now()
    };
  }

  async validateOrder(orderData: OrderData): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.account) {
      errors.push('Wallet not connected');
      return { valid: false, errors, warnings };
    }

    // Basic validation
    if (!orderData.orderId || !orderData.tradeId) {
      errors.push('Missing order or trade ID');
    }

    if (orderData.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (orderData.price <= 0) {
      errors.push('Price must be greater than 0');
    }

    // Balance validation (simplified for demo)
    try {
      if (orderData.type === 'buy') {
        // For buy orders, check if user has enough of tokenB (payment token)
        const totalCost = orderData.quantity * orderData.price;
        warnings.push(`Buy order requires ${totalCost.toFixed(4)} of payment token`);
      } else if (orderData.type === 'sell') {
        // For sell orders, check if user has enough of tokenA (selling token)
        warnings.push(`Sell order requires ${orderData.quantity.toFixed(4)} of selling token`);
      }
    } catch (error) {
      warnings.push('Could not validate balances - order will be checked on submission');
    }

    // Deadline validation
    const currentTime = Math.floor(Date.now() / 1000);
    if (orderData.deadline <= currentTime) {
      errors.push('Order deadline has passed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ===== SIGNATURE OPERATIONS =====

  async signMessage(message: string): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    try {
      const signature = await this.web3.eth.personal.sign(message, this.account, '');
      return signature;
    } catch (error) {
      console.error('Message signing failed:', error);
      throw error;
    }
  }

  async signOrder(orderData: OrderData): Promise<TradeSignature> {
    if (!this.account) throw new Error('Wallet not connected');

    // Create structured message for signing
    const message = this.createOrderMessage(orderData);
    
    try {
      const signature = await this.signMessage(message);
      
      return {
        signature,
        orderData,
        timestamp: Date.now(),
        userAddress: this.account
      };
    } catch (error) {
      console.error('Order signing failed:', error);
      throw error;
    }
  }

  async signTradeData(tradeData: any): Promise<string> {
    const orderData = this.createOrderData({
      type: tradeData.type || 'buy',
      price: tradeData.price || 1,
      quantity: tradeData.quantity || 1,
      tokenA: tradeData.tokenA,
      tokenB: tradeData.tokenB,
      counterpartyAddress: tradeData.counterpartyAddress
    });

    const tradeSignature = await this.signOrder(orderData);
    return tradeSignature.signature;
  }

  private createOrderMessage(orderData: OrderData): string {
    return [
      `Order ID: ${orderData.orderId}`,
      `Trade ID: ${orderData.tradeId}`,
      `Type: ${orderData.type.toUpperCase()}`,
      `Token A: ${orderData.tokenA}`,
      `Token B: ${orderData.tokenB}`,
      `Amount A: ${orderData.amountA}`,
      `Amount B: ${orderData.amountB}`,
      `Price: ${orderData.price}`,
      `Quantity: ${orderData.quantity}`,
      `Deadline: ${orderData.deadline}`,
      `Nonce: ${orderData.nonce}`
    ].join('\n');
  }

  // ===== TOKEN OPERATIONS =====

  async approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    try {
      const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
      const amountWei = this.web3.utils.toWei(amount, 'ether');

      const tx = await contract.methods.approve(spenderAddress, amountWei).send({
        from: this.account
      });

      return tx.transactionHash;
    } catch (error) {
      console.error('Token approval failed:', error);
      throw error;
    }
  }

  async getTokenInfo(tokenAddress: string): Promise<{
    symbol: string;
    decimals: number;
    address: string;
  }> {
    if (!this.web3) throw new Error('Wallet not connected');

    try {
      const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
      const [symbol, decimals] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.decimals().call()
      ]);

      return {
        symbol: symbol.toString(),
        decimals: Number(decimals),
        address: tokenAddress
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      return {
        symbol: 'UNKNOWN',
        decimals: 18,
        address: tokenAddress
      };
    }
  }

  // ===== NETWORK OPERATIONS =====

  async switchNetwork(networkId: number): Promise<boolean> {
    if (!window.ethereum) throw new Error('MetaMask not available');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkId.toString(16)}` }],
      });
      
      this.networkId = networkId;
      return true;
    } catch (error: any) {
      // If network doesn't exist, try to add it
      if (error.code === 4902) {
        return await this.addNetwork(networkId);
      }
      throw error;
    }
  }

  async addNetwork(networkId: number): Promise<boolean> {
    if (!window.ethereum) throw new Error('MetaMask not available');

    const network = SUPPORTED_NETWORKS[networkId];
    if (!network) throw new Error('Network not supported');

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${networkId.toString(16)}`,
          chainName: network.name,
          rpcUrls: network.rpcUrl ? [network.rpcUrl] : [],
          blockExplorerUrls: network.blockExplorerUrl ? [network.blockExplorerUrl] : [],
          nativeCurrency: network.nativeCurrency
        }]
      });
      
      this.networkId = networkId;
      return true;
    } catch (error) {
      console.error('Failed to add network:', error);
      return false;
    }
  }

  // ===== UTILITY FUNCTIONS =====

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatAmount(amount: number, decimals: number = 4): string {
    return amount.toFixed(decimals);
  }

  getTestTokenAddress(tokenSymbol: string, networkId: number): string {
    if (networkId === 31337) {
      return '0x0000000000000000000000000000000000000000';
    }
    
    const tokens = CONTRACT_ADDRESSES.TOKENS as any;
    return tokens[tokenSymbol]?.[networkId] || '0x0000000000000000000000000000000000000000';
  }

  getDEXContractAddress(): string | null {
    if (!this.networkId) return null;
    
    const address = CONTRACT_ADDRESSES.DEX_SETTLEMENT[this.networkId as keyof typeof CONTRACT_ADDRESSES.DEX_SETTLEMENT];
    return address !== '0x0000000000000000000000000000000000000000' ? address : null;
  }

  // ===== ERROR HANDLING =====

  handleError(error: any): string {
    console.error('Wallet error:', error);

    if (error.code === 4001) {
      return 'Transaction rejected by user';
    }
    
    if (error.code === -32603) {
      return 'Network error - please try again';
    }
    
    if (error.message?.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }

    if (error.message?.includes('User denied')) {
      return 'Signature rejected by user';
    }
    
    return error.message || 'Unknown error occurred';
  }
}

// Singleton instance
export const walletService = new WalletService();