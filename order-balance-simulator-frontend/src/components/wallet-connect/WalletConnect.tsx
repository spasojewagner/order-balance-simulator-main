import React, { useState, useEffect, useCallback, useMemo } from "react";
import Web3 from "web3";
import { useAppDispatch, useAppSelector } from "../../store";
import { setWalletAddress, setWalletConnected, setBalance1, setBalance2 } from "../../store";
import { toast } from "react-toastify";

// Type definitions
interface WindowWithEthereum extends Window {
  ethereum?: any;
}

declare const window: WindowWithEthereum;

interface TokenBalance {
  balance: string;
  decimals: number;
  formatted: number;
}

interface OrderData {
  type: string;
  symbol: string;
  price: number;
  quantity: number;
  total: number;
}

interface SupportedNetworks {
  [key: number]: {
    name: string;
    rpcUrl?: string;
    blockExplorerUrl?: string;
  };
}

interface TokenAddresses {
  [key: string]: string;
}

interface ContractAddresses {
  TRADING: string;
  TOKENS: TokenAddresses;
}

// ERC20 Token ABI (minimal)
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }
] as const;

// Trading Contract ABI (minimal)
const TRADING_CONTRACT_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "tokenA", "type": "address"},
      {"name": "tokenB", "type": "address"},
      {"name": "amountA", "type": "uint256"},
      {"name": "priceB", "type": "uint256"},
      {"name": "orderType", "type": "uint8"}
    ],
    "name": "placeOrder",
    "outputs": [{"name": "orderId", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "orderId", "type": "uint256"}],
    "name": "cancelOrder",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserOrders",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "type": "function"
  }
] as const;

// Enhanced network configuration
const SUPPORTED_NETWORKS: SupportedNetworks = {
  1: {
    name: "Ethereum Mainnet",
    blockExplorerUrl: "https://etherscan.io"
  },
  5: {
    name: "Goerli Testnet",
    blockExplorerUrl: "https://goerli.etherscan.io"
  },
  137: {
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorerUrl: "https://polygonscan.com"
  },
  80001: {
    name: "Polygon Mumbai Testnet",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorerUrl: "https://mumbai.polygonscan.com"
  },
  11155111: {
    name: "Sepolia Testnet",
    blockExplorerUrl: "https://sepolia.etherscan.io"
  }
};

// Contract addresses configuration
// Option 1: Use environment variables through Vite's import.meta.env (if using Vite)
const getEnvVar = (key: string, defaultValue: string): string => {
  // For Vite projects
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  // For Create React App projects
  if (typeof window !== 'undefined' && (window as any).env) {
    return (window as any).env[key] || defaultValue;
  }
  // Fallback to default
  return defaultValue;
};

// Contract addresses (replace with actual deployed addresses)
const CONTRACTS: ContractAddresses = {
  TRADING: getEnvVar("VITE_TRADING_CONTRACT_ADDRESS", "0x1234567890123456789012345678901234567890"),
  TOKENS: {
    BTC: getEnvVar("VITE_WBTC_ADDRESS", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"),
    ETH: getEnvVar("VITE_WETH_ADDRESS", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    BNB: getEnvVar("VITE_BNB_ADDRESS", "0xB8c77482e45F1F44dE1745F52C74426C631bDD52"),
    ADA: getEnvVar("VITE_ADA_ADDRESS", "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47")
  }
};

interface WalletConnectProps {
  onTradeExecute?: (orderData: OrderData) => Promise<string>;
  showNetworkSwitch?: boolean;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ 
  onTradeExecute, 
  showNetworkSwitch = true 
}) => {
  const dispatch = useAppDispatch();
  const { walletAddress, walletConnected } = useAppSelector((state) => state.app);
  const currentSymbol = useAppSelector((state) => state.app.currentSymbol);
  
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string>("");

  // Memoized network info
  const currentNetwork = useMemo(() => {
    return networkId ? SUPPORTED_NETWORKS[networkId] : null;
  }, [networkId]);

  const isNetworkSupported = useMemo(() => {
    return networkId ? Boolean(SUPPORTED_NETWORKS[networkId]) : false;
  }, [networkId]);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useMemo(() => {
    return typeof window !== 'undefined' && Boolean(window.ethereum?.isMetaMask);
  }, []);

  const connectWallet = useCallback(async (): Promise<void> => {
    if (!window.ethereum) {
      setConnectionError("Please install MetaMask to use this feature!");
      toast.error("MetaMask not detected!");
      return;
    }

    try {
      setIsLoading(true);
      setConnectionError("");
      
      // Request account access
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock MetaMask.");
      }

      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);

      // Get network ID with proper error handling
      let networkId: number;
      try {
        const chainId = await web3Instance.eth.getChainId();
        networkId = Number(chainId);
      } catch (netError) {
        console.warn("Failed to get chain ID, using net_version:", netError);
        const netId = await web3Instance.eth.net.getId();
        networkId = Number(netId);
      }
      
      setNetworkId(networkId);

      const account = accounts[0];
      
      // Update Redux store
      dispatch(setWalletAddress(account));
      dispatch(setWalletConnected(true));
      
      // Store connection state
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', account);

      // Load token balances
      await loadTokenBalances(web3Instance, account);

      // Show success message with network info
      const networkName = SUPPORTED_NETWORKS[networkId]?.name || `Unknown Network (${networkId})`;
      toast.success(`Wallet connected to ${networkName}`);

      // Listen for account and network changes
      setupEventListeners(web3Instance);

    } catch (error: any) {
      console.error("Wallet connection error:", error);
      const errorMessage = error.message || "Unknown error occurred";
      setConnectionError(errorMessage);
      toast.error(`Connection failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  const setupEventListeners = useCallback((web3Instance: Web3) => {
    if (!window.ethereum) return;

    // Remove existing listeners to prevent duplicates
    window.ethereum.removeAllListeners("accountsChanged");
    window.ethereum.removeAllListeners("chainChanged");

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]): void => {
      if (accounts.length === 0) {
        disconnectWallet();
        toast.info("Account disconnected");
      } else if (accounts[0] !== walletAddress) {
        dispatch(setWalletAddress(accounts[0]));
        localStorage.setItem('walletAddress', accounts[0]);
        loadTokenBalances(web3Instance, accounts[0]);
        toast.info(`Switched to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    };

    // Listen for network changes
    const handleNetworkChanged = (chainId: string): void => {
      const newNetworkId = parseInt(chainId, 16);
      setNetworkId(newNetworkId);
      
      const networkName = SUPPORTED_NETWORKS[newNetworkId]?.name;
      if (networkName) {
        toast.info(`Switched to ${networkName}`);
        // Reload balances for new network
        if (walletAddress) {
          loadTokenBalances(web3Instance, walletAddress);
        }
      } else {
        toast.warning(`Switched to unsupported network (${newNetworkId})`);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleNetworkChanged);
  }, [walletAddress, dispatch]);

  const disconnectWallet = useCallback((): void => {
    dispatch(setWalletAddress(''));
    dispatch(setWalletConnected(false));
    dispatch(setBalance1(0));
    dispatch(setBalance2(0));
    setWeb3(null);
    setNetworkId(null);
    setConnectionError("");
    
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
    
    // Remove listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners("accountsChanged");
      window.ethereum.removeAllListeners("chainChanged");
    }
    
    toast.info("Wallet disconnected");
  }, [dispatch]);

  const getTokenBalance = useCallback(async (
    web3Instance: Web3, 
    tokenAddress: string, 
    accountAddress: string
  ): Promise<TokenBalance> => {
    const contract = new web3Instance.eth.Contract(ERC20_ABI, tokenAddress);
    
    try {
      const [balance, decimals] = await Promise.all([
        contract.methods.balanceOf(accountAddress).call(),
        contract.methods.decimals().call()
      ]);
      
      const decimalsBN = Number(decimals);
      const balanceBN = BigInt(balance.toString());
      const divisor = BigInt(10 ** decimalsBN);
      
      // More precise calculation using BigInt
      const formatted = Number(balanceBN) / Number(divisor);
      
      return {
        balance: balance.toString(),
        decimals: decimalsBN,
        formatted
      };
    } catch (error) {
      console.error(`Error fetching balance for token ${tokenAddress}:`, error);
      throw error;
    }
  }, []);

  const loadTokenBalances = useCallback(async (
    web3Instance: Web3, 
    account: string
  ): Promise<void> => {
    if (!currentSymbol) return;

    try {
      setBalanceLoading(true);
      
      // Get ETH balance
      const ethBalance = await web3Instance.eth.getBalance(account);
      const ethBalanceInEth = parseFloat(web3Instance.utils.fromWei(ethBalance, 'ether'));
      
      // Get token addresses for current symbol
      const tokenAAddress = CONTRACTS.TOKENS[currentSymbol.coinA as keyof typeof CONTRACTS.TOKENS];
      const tokenBAddress = CONTRACTS.TOKENS[currentSymbol.coinB as keyof typeof CONTRACTS.TOKENS];
      
      let tokenABalance = 0;
      let tokenBBalance = 0;

      // Load Token A balance
      if (currentSymbol.coinA === 'ETH') {
        tokenABalance = ethBalanceInEth;
      } else if (tokenAAddress && tokenAAddress !== "0x") {
        try {
          const tokenBalance = await getTokenBalance(web3Instance, tokenAAddress, account);
          tokenABalance = tokenBalance.formatted;
        } catch (error) {
          console.warn(`Failed to load ${currentSymbol.coinA} balance:`, error);
          tokenABalance = 0;
        }
      }

      // Load Token B balance
      if (currentSymbol.coinB === 'ETH') {
        tokenBBalance = ethBalanceInEth;
      } else if (tokenBAddress && tokenBAddress !== "0x") {
        try {
          const tokenBalance = await getTokenBalance(web3Instance, tokenBAddress, account);
          tokenBBalance = tokenBalance.formatted;
        } catch (error) {
          console.warn(`Failed to load ${currentSymbol.coinB} balance:`, error);
          tokenBBalance = 0;
        }
      }

      // Update Redux store
      dispatch(setBalance1(tokenABalance));
      dispatch(setBalance2(tokenBBalance));

      console.log('💰 Token balances loaded:', {
        account: account.slice(0, 6) + '...' + account.slice(-4),
        network: currentNetwork?.name || 'Unknown',
        ethBalance: ethBalanceInEth.toFixed(4),
        [`${currentSymbol.coinA} balance`]: tokenABalance.toFixed(4),
        [`${currentSymbol.coinB} balance`]: tokenBBalance.toFixed(4)
      });

    } catch (error) {
      console.error('Error loading token balances:', error);
      toast.error('Failed to load token balances');
    } finally {
      setBalanceLoading(false);
    }
  }, [currentSymbol, currentNetwork, dispatch, getTokenBalance]);

  const executeOnChainTrade = useCallback(async (orderData: OrderData): Promise<string | null> => {
    if (!web3 || !walletAddress) {
      toast.error("Please connect your wallet first");
      return null;
    }

    if (!CONTRACTS.TRADING || CONTRACTS.TRADING.startsWith("0x123")) {
      toast.error("Trading contract not configured properly");
      return null;
    }

    try {
      setIsLoading(true);
      
      const tradingContract = new web3.eth.Contract(
        TRADING_CONTRACT_ABI,
        CONTRACTS.TRADING
      );

      // Prepare transaction data
      const tokenAAddress = CONTRACTS.TOKENS[currentSymbol.coinA as keyof typeof CONTRACTS.TOKENS];
      const tokenBAddress = CONTRACTS.TOKENS[currentSymbol.coinB as keyof typeof CONTRACTS.TOKENS];
      
      if (!tokenAAddress || !tokenBAddress) {
        throw new Error("Token addresses not configured");
      }

      // Convert amounts to proper decimals (assuming 18 decimals, should be dynamic)
      const amountA = web3.utils.toWei(orderData.quantity.toString(), 'ether');
      const priceB = web3.utils.toWei(orderData.price.toString(), 'ether');
      
      // Determine order type (0 = buy, 1 = sell)
      const orderType = orderData.type.toLowerCase().includes('buy') ? 0 : 1;

      // Check token approval if needed
      if (orderType === 1) { // Selling tokenA
        await checkAndApproveToken(web3, tokenAAddress, walletAddress, amountA);
      } else { // Buying tokenA with tokenB
        const totalCost = web3.utils.toWei(orderData.total.toString(), 'ether');
        await checkAndApproveToken(web3, tokenBAddress, walletAddress, totalCost);
      }

      // Execute the trade with better gas estimation
      const gasEstimate = await tradingContract.methods
        .placeOrder(tokenAAddress, tokenBAddress, amountA, priceB, orderType)
        .estimateGas({ from: walletAddress });

      const gasPrice = await web3.eth.getGasPrice();
      const gasLimit = Math.floor(Number(gasEstimate) * 1.3); // 30% buffer

      const transaction = await tradingContract.methods
        .placeOrder(tokenAAddress, tokenBAddress, amountA, priceB, orderType)
        .send({
          from: walletAddress,
          gas: gasLimit,
          gasPrice: gasPrice
        });

      toast.success(`Trade executed! Tx: ${transaction.transactionHash.slice(0, 10)}...`);
      
      // Reload balances after trade
      await loadTokenBalances(web3, walletAddress);
      
      return transaction.transactionHash;

    } catch (error: any) {
      console.error('On-chain trade execution failed:', error);
      
      // Better error handling
      let errorMessage = 'Trade execution failed';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas or tokens';
      } else if (error.message.includes('user denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [web3, walletAddress, currentSymbol, loadTokenBalances]);

  const checkAndApproveToken = useCallback(async (
    web3Instance: Web3,
    tokenAddress: string,
    owner: string,
    amount: string
  ): Promise<void> => {
    const tokenContract = new web3Instance.eth.Contract(ERC20_ABI, tokenAddress);
    
    try {
      // Check current allowance
      const allowance = await tokenContract.methods.allowance(owner, CONTRACTS.TRADING).call();
      
      if (BigInt(allowance.toString()) < BigInt(amount)) {
        toast.info("Approving token spend...");
        
        const gasEstimate = await tokenContract.methods
          .approve(CONTRACTS.TRADING, amount)
          .estimateGas({ from: owner });
        
        const gasPrice = await web3Instance.eth.getGasPrice();
        
        await tokenContract.methods
          .approve(CONTRACTS.TRADING, amount)
          .send({
            from: owner,
            gas: Math.floor(Number(gasEstimate) * 1.2),
            gasPrice: gasPrice
          });
        
        toast.success("Token approval confirmed!");
      }
    } catch (error: any) {
      console.error('Token approval failed:', error);
      throw new Error(`Token approval failed: ${error.message}`);
    }
  }, []);

  const switchNetwork = useCallback(async (targetNetworkId: number): Promise<void> => {
    if (!window.ethereum) {
      toast.error("MetaMask not available");
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetNetworkId.toString(16)}` }],
      });
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      
      // If network doesn't exist in MetaMask, try to add it
      if (error.code === 4902 && SUPPORTED_NETWORKS[targetNetworkId]?.rpcUrl) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetNetworkId.toString(16)}`,
              chainName: SUPPORTED_NETWORKS[targetNetworkId].name,
              rpcUrls: [SUPPORTED_NETWORKS[targetNetworkId].rpcUrl!],
              blockExplorerUrls: [SUPPORTED_NETWORKS[targetNetworkId].blockExplorerUrl!]
            }]
          });
        } catch (addError) {
          toast.error('Failed to add network to MetaMask');
        }
      } else {
        toast.error('Failed to switch network');
      }
    }
  }, []);

  const refreshBalances = useCallback((): void => {
    if (web3 && walletAddress) {
      loadTokenBalances(web3, walletAddress);
    }
  }, [web3, walletAddress, loadTokenBalances]);

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (window.ethereum && localStorage.getItem('walletConnected') === 'true') {
        await connectWallet();
      }
    };
    
    autoConnect();
  }, [connectWallet]);

  // Load balances when symbol or network changes
  useEffect(() => {
    if (web3 && walletAddress && currentSymbol) {
      loadTokenBalances(web3, walletAddress);
    }
  }, [currentSymbol, networkId, web3, walletAddress, loadTokenBalances]);

  // Expose trade execution function
  useEffect(() => {
    if (onTradeExecute && executeOnChainTrade) {
      // This would typically be registered with a parent component or context
      // onTradeExecute.current = executeOnChainTrade;
    }
  }, [onTradeExecute, executeOnChainTrade]);

  if (!isMetaMaskInstalled) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-yellow-400">
          MetaMask not detected
        </div>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
        >
          Install MetaMask
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {walletConnected && walletAddress ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-gray-300">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <div className="flex items-center gap-2 text-xs">
              {currentNetwork && (
                <span className={`${isNetworkSupported ? 'text-green-400' : 'text-yellow-400'}`}>
                  {currentNetwork.name}
                </span>
              )}
              {balanceLoading && (
                <span className="text-gray-500 animate-pulse">Loading...</span>
              )}
            </div>
          </div>
          
          <button
            onClick={refreshBalances}
            disabled={balanceLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <svg 
              className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
          
          <button
            onClick={disconnectWallet}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
          {connectionError && (
            <div className="text-xs text-red-400 max-w-xs">
              {connectionError}
            </div>
          )}
        </div>
      )}
      
      {showNetworkSwitch && networkId && !isNetworkSupported && (
        <button
          onClick={() => switchNetwork(1)} // Switch to Ethereum mainnet
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors"
          title={`Current network (${networkId}) is not supported`}
        >
          Switch Network
        </button>
      )}
    </div>
  );
};

export default WalletConnect;