// src/services/walletService.ts - FIXED VERSION BEZ GREŠAKA

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

// Contract addresses (PLACEHOLDER - update after deployment)
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
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT
      5: '0x0000000000000000000000000000000000000000', // Mock USDT
      11155111: '0x0000000000000000000000000000000000000000' // Mock USDT
    },
    USDC: {
      1: '0xA0b86a33E6417eFb1C6088D5EB6e9F83f9D0Dc8e', // Real USDC
      5: '0x0000000000000000000000000000000000000000', // Mock USDC
      11155111: '0x0000000000000000000000000000000000000000' // Mock USDC
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

      // Setup event listeners
      this.setupEventListeners();

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
    
    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners?.('accountsChanged');
      window.ethereum.removeAllListeners?.('chainChanged');
    }
  }

  private setupEventListeners(): void {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.account = accounts[0];
      }
    });

    window.ethereum.on('chainChanged', (chainId: string) => {
      this.networkId = parseInt(chainId, 16);
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

  // ===== BALANCE OPERATIONS =====

  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<{
    balance: string;
    decimals: number;
    formatted: string;
  }> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
    
    try {
      const [balance, decimals] = await Promise.all([
        contract.methods.balanceOf(account).call(),
        contract.methods.decimals().call()
      ]);

      const formatted = this.web3.utils.fromWei(balance, 'ether');

      return {
        balance: balance.toString(),
        decimals: Number(decimals),
        formatted
      };
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return {
        balance: '0',
        decimals: 18,
        formatted: '0'
      };
    }
  }

  async getETHBalance(userAddress?: string): Promise<string> {
    if (!this.web3) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    try {
      const balanceWei = await this.web3.eth.getBalance(account);
      return this.web3.utils.fromWei(balanceWei, 'ether');
    } catch (error) {
      console.error('Failed to get ETH balance:', error);
      return '0';
    }
  }

  async getDEXBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    if (!this.web3 || !this.networkId) throw new Error('Wallet not connected');
    
    const account = userAddress || this.account;
    if (!account) throw new Error('No account available');

    const dexAddresses = CONTRACT_ADDRESSES.DEX_SETTLEMENT as Record<number, string>;
    const dexAddress = dexAddresses[this.networkId];
    
    if (!dexAddress || dexAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('DEX contract not deployed on this network');
      return '0';
    }

    try {
      const dexContract = new this.web3.eth.Contract(DEX_CONTRACT_ABI, dexAddress);
      const balance = await dexContract.methods.getBalance(account, tokenAddress).call();
      
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Failed to get DEX balance:', error);
      return '0';
    }
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

  async signTradeData(tradeData: TradeSignatureData): Promise<string> {
    if (!this.web3 || !this.account) throw new Error('Wallet not connected');

    // For now, sign a simple message. Later can implement EIP-712
    const message = `Trade: ${tradeData.tradeId} - ${tradeData.amountA} for ${tradeData.amountB}`;
    
    try {
      const signature = await this.signMessage(message);
      return signature;
    } catch (error) {
      console.error('Trade signing failed:', error);
      throw error;
    }
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

  // ===== NETWORK OPERATIONS =====

  async switchNetwork(networkId: number): Promise<boolean> {
    if (!window.ethereum) throw new Error('MetaMask not available');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkId.toString(16)}` }],
      });
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
      return true;
    } catch (error) {
      console.error('Failed to add network:', error);
      return false;
    }
  }

  // ===== UTILITY FUNCTIONS =====

  formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatBalance(balance: string, decimals = 4): string {
    const num = parseFloat(balance);
    return num.toFixed(decimals);
  }

  isValidAddress(address: string): boolean {
    if (!this.web3) return false;
    return this.web3.utils.isAddress(address);
  }

  generateTradeId(): string {
    return `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }

  // ===== ERROR HANDLING =====

  handleError(error: any): string {
    if (error.code === 4001) {
      return 'Transaction rejected by user';
    } else if (error.code === -32603) {
      return 'Internal JSON-RPC error';
    } else if (error.message?.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    } else if (error.message?.includes('User denied')) {
      return 'Transaction denied by user';
    } else if (error.message?.includes('gas')) {
      return 'Gas estimation failed or limit too low';
    }
    
    return error.message || 'Unknown error occurred';
  }
}

// Singleton instance
export const walletService = new WalletService();