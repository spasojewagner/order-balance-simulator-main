// src/services/walletService.ts - COMPLETE BLOCKCHAIN INTEGRATION

import Web3 from 'web3';

// ===== TYPES & INTERFACES =====

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface TradeSignatureData {
  tradeId: string;
  buyer: string;
  seller: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  deadline: number;
  nonce: number;
}

export interface WalletBalance {
  token: string;
  balance: string;
  decimals: number;
  symbol: string;
  formatted: string;
}

export interface NetworkConfig {
  name: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface OrderSignatureData {
  orderId: string;
  userAddress: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  price: string;
  orderType: 'buy' | 'sell';
  timestamp: number;
  nonce: number;
}

// ===== CONSTANTS =====

// Network configurations
export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
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

// Contract addresses (UPDATE AFTER DEPLOYMENT)
export const CONTRACT_ADDRESSES = {
  DEX_SETTLEMENT: {
    1: '0x0000000000000000000000000000000000000000', // Mainnet
    5: '0x0000000000000000000000000000000000000000', // Goerli
    11155111: '0x0000000000000000000000000000000000000000', // Sepolia
    137: '0x0000000000000000000000000000000000000000', // Polygon
    80001: '0x0000000000000000000000000000000000000000' // Mumbai
  },
  TOKENS: {
    USDT: {
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT Mainnet
      5: '0x0000000000000000000000000000000000000000', // Test USDT Goerli
      11155111: '0x0000000000000000000000000000000000000000', // Test USDT Sepolia
      137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Real USDT Polygon
      80001: '0x0000000000000000000000000000000000000000' // Test USDT Mumbai
    },
    USDC: {
      1: '0xA0b86a33E6417eFb1C6088D5EB6e9F83f9D0Dc8e', // Real USDC Mainnet
      5: '0x0000000000000000000000000000000000000000', // Test USDC Goerli
      11155111: '0x0000000000000000000000000000000000000000', // Test USDC Sepolia
      137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Real USDC Polygon
      80001: '0x0000000000000000000000000000000000000000' // Test USDC Mumbai
    },
    WETH: {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH Mainnet
      5: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // WETH Goerli
      11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH Sepolia
      137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH Polygon
      80001: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889' // WETH Mumbai
    }
  }
};

// ERC20 ABI (complete for balance and approve operations)
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
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// DEX Contract ABI (expanded for trading operations)
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
  },
  {
    "inputs": [
      {"internalType": "address", "name": "_token", "type": "address"},
      {"internalType": "uint256", "name": "_amount", "type": "uint256"}
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "_token", "type": "address"},
      {"internalType": "uint256", "name": "_amount", "type": "uint256"}
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ===== WALLET SERVICE CLASS =====

export class WalletService {
  private web3: Web3 | null = null;
  private account: string | null = null;
  private networkId: number | null = null;

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

      console.log('🔗 Connecting to MetaMask...');

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

      // Setup event listeners
      this.setupEventListeners();

      console.log('✅ MetaMask connected:', {
        account: this.account,
        networkId: this.networkId,
        networkName: this.getNetworkName()
      });

      return {
        success: true,
        account: this.account as string,
        networkId: this.networkId
      };

    } catch (error: any) {
      console.error('❌ Wallet connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting wallet...');
    
    this.web3 = null;
    this.account = null;
    this.networkId = null;
    
    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners?.('accountsChanged');
      window.ethereum.removeAllListeners?.('chainChanged');
      window.ethereum.removeAllListeners?.('disconnect');
    }
    
    console.log('✅ Wallet disconnected');
  }

  private setupEventListeners(): void {
    if (!window.ethereum) return;

    console.log('👂 Setting up MetaMask event listeners...');

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      console.log('👤 Account changed:', accounts);
      if (accounts.length === 0) {
        this.disconnect();
        // Dispatch custom event for components to handle
        window.dispatchEvent(new CustomEvent('walletDisconnected'));
      } else {
        this.account = accounts[0];
        // Dispatch custom event for components to handle
        window.dispatchEvent(new CustomEvent('walletAccountChanged', { 
          detail: { account: accounts[0] } 
        }));
      }
    });

    window.ethereum.on('chainChanged', (chainId: string) => {
      const newNetworkId = parseInt(chainId, 16);
      console.log('🌐 Network changed:', newNetworkId);
      this.networkId = newNetworkId;
      // Dispatch custom event for components to handle
      window.dispatchEvent(new CustomEvent('walletNetworkChanged', { 
        detail: { networkId: newNetworkId } 
      }));
    });

    window.ethereum.on('disconnect', (error: any) => {
      console.log('🔌 MetaMask disconnected:', error);
      this.disconnect();
    });
  }

  // ===== GETTERS =====

  getAccount(): string | null {
    return this.account;
  }

  getNetworkId(): number | null {
    return this.networkId;
  }

  getNetworkName(): string {
    if (!this.networkId) return 'Unknown';
    return SUPPORTED_NETWORKS[this.networkId]?.name || `Network ${this.networkId}`;
  }

  isConnected(): boolean {
    return !!(this.web3 && this.account);
  }

  getBlockExplorerUrl(): string {
    if (!this.networkId) return '';
    return SUPPORTED_NETWORKS[this.networkId]?.blockExplorerUrl || '';
  }

  // ===== TOKEN ADDRESS HELPERS =====

  getTestTokenAddress(tokenSymbol: 'USDT' | 'USDC' | 'WETH', networkId: number): string {
    const addresses = CONTRACT_ADDRESSES.TOKENS[tokenSymbol] as Record<number, string>;
    return addresses[networkId] || '0x0000000000000000000000000000000000000000';
  }

  getDEXContractAddress(networkId?: number): string {
    const network = networkId || this.networkId;
    if (!network) return '0x0000000000000000000000000000000000000000';
    
    const addresses = CONTRACT_ADDRESSES.DEX_SETTLEMENT as Record<number, string>;
    return addresses[network] || '0x0000000000000000000000000000000000000000';
  }

  // ===== BALANCE OPERATIONS =====

  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<{
    balance: string;
    decimals: number;
    formatted: string;
    symbol: string;
  }> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    console.log(`💰 Getting token balance for ${tokenAddress} on account ${account}`);

    const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
    
    try {
      const [balance, decimals, symbol] = await Promise.all([
        contract.methods.balanceOf(account).call(),
        contract.methods.decimals().call(),
        contract.methods.symbol().call().catch(() => 'TOKEN')
      ]);

      // Convert from wei to readable format using actual decimals
      const divisor = Math.pow(10, Number(decimals));
      const formatted = (Number(balance) / divisor).toString();

      console.log(`✅ Token balance loaded:`, {
        symbol,
       balance: String(balance),  
      decimals: Number(decimals),
      formatted: String((Number(balance) / Math.pow(10, Number(decimals))))
      });

      return {
        balance: String(balance),  
        decimals: Number(decimals),
        formatted,
        symbol: String(symbol)
      };
    } catch (error) {
      console.error('❌ Failed to get token balance:', error);
      return {
        balance: '0',
        decimals: 18,
        formatted: '0',
        symbol: 'TOKEN'
      };
    }
  }

  async getETHBalance(userAddress?: string): Promise<string> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    console.log(`💰 Getting ETH balance for ${account}`);

    try {
      const balanceWei = await this.web3.eth.getBalance(account);
      const balanceEth = this.web3.utils.fromWei(balanceWei, 'ether');
      
      console.log(`✅ ETH balance: ${balanceEth}`);
      return balanceEth;
    } catch (error) {
      console.error('❌ Failed to get ETH balance:', error);
      return '0';
    }
  }

  async getDEXBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    if (!this.web3 || !this.networkId) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    const dexAddress = this.getDEXContractAddress();
    
    if (!dexAddress || dexAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️ DEX contract not deployed on this network');
      return '0';
    }

    console.log(`💰 Getting DEX balance for ${tokenAddress} on ${dexAddress}`);

    try {
      const dexContract = new this.web3.eth.Contract(DEX_CONTRACT_ABI, dexAddress);
      const balance = await dexContract.methods.getBalance(account, tokenAddress).call();
      
      const balanceEth = this.web3.utils.fromWei(String(balance), 'ether');
      console.log(`✅ DEX balance: ${balanceEth}`);
      return balanceEth;
    } catch (error) {
      console.error('❌ Failed to get DEX balance:', error);
      return '0';
    }
  }

  // ===== SIGNATURE OPERATIONS =====

  async signMessage(message: string): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    console.log('🔐 Signing message:', message);

    try {
      const signature = await this.web3.eth.personal.sign(message, this.account, '');
      console.log('✅ Message signed successfully');
      return signature;
    } catch (error) {
      console.error('❌ Message signing failed:', error);
      throw error;
    }
  }

  async signTradeData(tradeData: TradeSignatureData): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    console.log('🔐 Signing trade data:', tradeData);

    // Create structured message for signing
    const message = this.createTradeMessage(tradeData);
    
    try {
      const signature = await this.signMessage(message);
      console.log('✅ Trade data signed successfully');
      return signature;
    } catch (error) {
      console.error('❌ Trade signing failed:', error);
      throw error;
    }
  }

  async signOrderData(orderData: OrderSignatureData): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    console.log('🔐 Signing order data:', orderData);

    // Create structured message for order signing
    const message = this.createOrderMessage(orderData);
    
    try {
      const signature = await this.signMessage(message);
      console.log('✅ Order signed successfully');
      return signature;
    } catch (error) {
      console.error('❌ Order signing failed:', error);
      throw error;
    }
  }

  private createTradeMessage(tradeData: TradeSignatureData): string {
    return `DEXCHANGE TRADE AUTHORIZATION

Trade ID: ${tradeData.tradeId}
Buyer: ${tradeData.buyer}
Seller: ${tradeData.seller}
Token A: ${tradeData.tokenA}
Token B: ${tradeData.tokenB}
Amount A: ${tradeData.amountA}
Amount B: ${tradeData.amountB}
Deadline: ${new Date(tradeData.deadline * 1000).toISOString()}
Nonce: ${tradeData.nonce}

By signing this message, you authorize the execution of this trade.`;
  }

  private createOrderMessage(orderData: OrderSignatureData): string {
    return `DEXCHANGE ORDER SIGNATURE

Order ID: ${orderData.orderId}
User: ${orderData.userAddress}
Type: ${orderData.orderType.toUpperCase()} ORDER
Token A: ${orderData.tokenA}
Token B: ${orderData.tokenB}
Amount A: ${orderData.amountA}
Amount B: ${orderData.amountB}
Price: ${orderData.price}
Timestamp: ${new Date(orderData.timestamp).toISOString()}
Nonce: ${orderData.nonce}

By signing this message, you confirm this order creation.`;
  }

  // ===== TOKEN OPERATIONS =====

  async approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    console.log('🔓 Approving token:', {
      token: tokenAddress,
      spender: spenderAddress,
      amount
    });

    try {
      const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
      
      // Get token decimals for proper amount conversion
      const decimals = await contract.methods.decimals().call();
      const divisor = Math.pow(10, Number(decimals));
      const amountWei = (parseFloat(amount) * divisor).toString();

      const tx = await contract.methods.approve(spenderAddress, amountWei).send({
        from: this.account
      });

      console.log('✅ Token approved, TX hash:', tx.transactionHash);
      return tx.transactionHash;
    } catch (error) {
      console.error('❌ Token approval failed:', error);
      throw error;
    }
  }

  async checkAllowance(tokenAddress: string, spenderAddress: string): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    try {
      const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
      const allowance = await contract.methods.allowance(this.account, spenderAddress).call();
      
      return this.web3.utils.fromWei(String(allowance), 'ether');
    } catch (error) {
      console.error('❌ Failed to check allowance:', error);
      return '0';
    }
  }

  // ===== TRANSACTION OPERATIONS =====

  async estimateGas(to: string, data: string, value = '0'): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    try {
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.account,
        to,
        data,
        value: this.web3.utils.toWei(value, 'ether')
      });

      return gasEstimate.toString();
    } catch (error) {
      console.error('❌ Gas estimation failed:', error);
      return '21000'; // Default gas limit
    }
  }

  async getCurrentGasPrice(): Promise<string> {
    if (!this.web3) throw new Error('Wallet not connected');

    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      return gasPrice.toString();
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      return '20000000000'; // 20 gwei default
    }
  }

  // ===== NETWORK OPERATIONS =====

  async switchNetwork(networkId: number): Promise<boolean> {
    if (!window.ethereum) throw new Error('MetaMask not available');

    console.log('🌐 Switching to network:', networkId);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkId.toString(16)}` }],
      });
      
      console.log('✅ Network switched successfully');
      return true;
    } catch (error: any) {
      console.log('⚠️ Network switch failed, trying to add network...');
      // If network doesn't exist, try to add it
      if (error.code === 4902) {
        return await this.addNetwork(networkId);
      }
      console.error('❌ Network switch failed:', error);
      throw error;
    }
  }

  async addNetwork(networkId: number): Promise<boolean> {
    if (!window.ethereum) throw new Error('MetaMask not available');

    const network = SUPPORTED_NETWORKS[networkId];
    if (!network) throw new Error('Network not supported');

    console.log('➕ Adding network:', network.name);

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
      
      console.log('✅ Network added successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to add network:', error);
      return false;
    }
  }

  // ===== UTILITY FUNCTIONS =====

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatBalance(balance: string, decimals = 4): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    return num.toFixed(decimals);
  }

  isValidAddress(address: string): boolean {
    if (!this.web3 || !address) return false;
    return this.web3.utils.isAddress(address);
  }

  generateTradeId(): string {
    return `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  }

  generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNonce(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  // ===== BLOCKCHAIN VERIFICATION =====

  async verifySignature(message: string, signature: string, expectedSigner: string): Promise<boolean> {
    if (!this.web3) throw new Error('Wallet not connected');

    try {
      const recoveredAddress = await this.web3.eth.personal.ecRecover(message, signature);
      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return false;
    }
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    if (!this.web3) throw new Error('Wallet not connected');

    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error('❌ Failed to get transaction receipt:', error);
      return null;
    }
  }

  getTransactionUrl(txHash: string): string {
    const baseUrl = this.getBlockExplorerUrl();
    if (!baseUrl) return '';
    return `${baseUrl}/tx/${txHash}`;
  }

  getAddressUrl(address: string): string {
    const baseUrl = this.getBlockExplorerUrl();
    if (!baseUrl) return '';
    return `${baseUrl}/address/${address}`;
  }

  // ===== ERROR HANDLING =====

  handleError(error: any): string {
    console.error('🚨 Wallet error:', error);

    // User rejection errors
    if (error.code === 4001 || error.message?.includes('User denied')) {
      return 'Transaction rejected by user';
    }
    
    // Network/RPC errors
    if (error.code === -32603) {
      return 'Network error - please try again';
    }
    
    // Gas-related errors
    if (error.message?.includes('insufficient funds')) {
      return 'Insufficient funds for transaction + gas fees';
    }
    
    if (error.message?.includes('gas')) {
      return 'Gas estimation failed - transaction may fail';
    }
    
    // Contract errors
    if (error.message?.includes('execution reverted')) {
      return 'Transaction failed - please check your inputs';
    }
    
    // Network switch errors
    if (error.code === 4902) {
      return 'Network not found in MetaMask';
    }
    
    // Connection errors
    if (error.message?.includes('Not connected')) {
      return 'Please connect your wallet first';
    }
    
    // Generic fallback
    return error.message || 'Unknown blockchain error occurred';
  }

  // ===== BALANCE VALIDATION =====

  async validateBalance(tokenAddress: string, requiredAmount: string, userAddress?: string): Promise<{
    valid: boolean;
    currentBalance: string;
    error?: string;
  }> {
    try {
      const account = userAddress || this.account;
      if (!account) {
        return { valid: false, currentBalance: '0', error: 'No account connected' };
      }

      let currentBalance = '0';
      
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        // ETH balance
        currentBalance = await this.getETHBalance(account);
      } else {
        // Token balance
        const tokenBalance = await this.getTokenBalance(tokenAddress, account);
        currentBalance = tokenBalance.formatted;
      }

      const required = parseFloat(requiredAmount);
      const current = parseFloat(currentBalance);

      return {
        valid: current >= required,
        currentBalance,
        error: current < required ? `Insufficient balance. Required: ${required}, Available: ${current}` : undefined
      };

    } catch (error) {
      console.error('❌ Balance validation failed:', error);
      return {
        valid: false,
        currentBalance: '0',
        error: 'Failed to check balance'
      };
    }
  }
}

// Singleton instance
export const walletService = new WalletService();