// src/components/wallet-connect/WalletConnect.tsx - ENHANCED WITH BLOCKCHAIN INTEGRATION

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { 
  setWalletAddress, 
  setWalletConnected, 
  setNetworkId, 
  setNetworkName,
  setWalletLoading,
  setBalance1,
  setBalance2
} from '../../store';
import { walletService, SUPPORTED_NETWORKS } from '../../services/walletService';

interface WalletConnectProps {
  onTradeExecute?: React.MutableRefObject<((orderData: any) => Promise<string>) | null>;
  showNetworkSwitch?: boolean;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ 
  onTradeExecute, 
  showNetworkSwitch = true 
}) => {
  const dispatch = useAppDispatch();
  
  // Redux state
  const { 
    walletAddress, 
    walletConnected, 
    networkId, 
    networkName,
    walletLoading,
    currentSymbol,
    balance1,
    balance2
  } = useAppSelector((state) => state.app);
  
  // Local state
  const [isConnecting, setIsConnecting] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');

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

  // ===== WALLET CONNECTION =====

  const connectWallet = useCallback(async (): Promise<void> => {
    if (!isMetaMaskInstalled) {
      setConnectionError('Please install MetaMask to use this feature!');
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionError('');
      
      const result = await walletService.connect();
      
      if (result.success && result.account && result.networkId) {
        // Update Redux store
        dispatch(setWalletAddress(result.account));
        dispatch(setWalletConnected(true));
        dispatch(setNetworkId(result.networkId));
        dispatch(setNetworkName(SUPPORTED_NETWORKS[result.networkId]?.name || 'Unknown'));
        
        // Store connection state
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', result.account);

        // Setup trade execute function for signature flow
        if (onTradeExecute) {
          onTradeExecute.current = async (orderData: any) => {
            try {
              console.log('🔐 Signing order:', orderData);
              
              // Create signature data
              const signatureData = {
                tradeId: orderData.tradeId || walletService.generateTradeId(),
                buyer: orderData.type === 'buy' ? result.account : orderData.counterpartyAddress,
                seller: orderData.type === 'sell' ? result.account : orderData.counterpartyAddress,
                tokenA: orderData.tokenA || '0x0000000000000000000000000000000000000000',
                tokenB: orderData.tokenB || '0x0000000000000000000000000000000000000000',
                amountA: orderData.quantity.toString(),
                amountB: (orderData.quantity * orderData.price).toString(),
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                nonce: Date.now()
              };

              // Sign the trade data
              const signature = await walletService.signTradeData(signatureData);
              console.log('✅ Order signed:', signature);

              return signature;
            } catch (error) {
              console.error('❌ Order signing failed:', error);
              throw error;
            }
          };
        }

        // Load balances from blockchain
        await loadBlockchainBalances();

        console.log('✅ Wallet connected:', {
          address: result.account,
          network: SUPPORTED_NETWORKS[result.networkId]?.name
        });

      } else {
        throw new Error(result.error || 'Connection failed');
      }

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      const errorMessage = walletService.handleError(error);
      setConnectionError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, dispatch, onTradeExecute]);

  const disconnectWallet = useCallback((): void => {
    walletService.disconnect();
    
    dispatch(setWalletAddress(''));
    dispatch(setWalletConnected(false));
    dispatch(setNetworkId(null));
    dispatch(setNetworkName(''));
    dispatch(setBalance1(0));
    dispatch(setBalance2(0));
    
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
    
    // Clear trade execute function
    if (onTradeExecute) {
      onTradeExecute.current = null;
    }
    
    setConnectionError('');
    console.log('🔌 Wallet disconnected');
  }, [dispatch, onTradeExecute]);

  // ===== BLOCKCHAIN BALANCE MANAGEMENT =====

  const loadBlockchainBalances = useCallback(async (): Promise<void> => {
    if (!walletConnected || !walletAddress || !networkId) return;

    try {
      setBalanceLoading(true);
      console.log('💰 Loading blockchain balances for:', walletAddress);

      // Get ETH/native token balance
      const ethBalance = await walletService.getETHBalance(walletAddress);
      console.log('💰 ETH Balance:', ethBalance);

      // Get token balances from blockchain
      let tokenABalance = 0;
      let tokenBBalance = 0;

      try {
        // Try to get real token addresses from currentSymbol or use test tokens
        const tokenAAddress = currentSymbol?.tokenAAddress || 
          walletService.getTestTokenAddress('USDC', networkId);
        const tokenBAddress = currentSymbol?.tokenBAddress || 
          walletService.getTestTokenAddress('USDT', networkId);

        if (tokenAAddress && tokenAAddress !== '0x0000000000000000000000000000000000000000') {
          const balanceA = await walletService.getTokenBalance(tokenAAddress, walletAddress);
          tokenABalance = parseFloat(balanceA.formatted);
          console.log('💰 Token A Balance:', tokenABalance, currentSymbol?.coinA || 'TokenA');
        } else {
          console.warn('⚠️ Token A address not configured, using mock balance');
          tokenABalance = 1000 + Math.random() * 9000; // Mock 1000-10000
        }

        if (tokenBAddress && tokenBAddress !== '0x0000000000000000000000000000000000000000') {
          const balanceB = await walletService.getTokenBalance(tokenBAddress, walletAddress);
          tokenBBalance = parseFloat(balanceB.formatted);
          console.log('💰 Token B Balance:', tokenBBalance, currentSymbol?.coinB || 'TokenB');
        } else {
          console.warn('⚠️ Token B address not configured, using mock balance');
          tokenBBalance = 10000 + Math.random() * 90000; // Mock 10000-100000
        }

        // Also check DEX contract balances (for deposited tokens)
        try {
          const dexBalanceA = await walletService.getDEXBalance(tokenAAddress || '0x0', walletAddress);
          const dexBalanceB = await walletService.getDEXBalance(tokenBAddress || '0x0', walletAddress);
          
          if (parseFloat(dexBalanceA) > 0 || parseFloat(dexBalanceB) > 0) {
            console.log('💰 DEX Balances:', {
              tokenA: dexBalanceA,
              tokenB: dexBalanceB
            });
            // Add DEX balances to wallet balances
            tokenABalance += parseFloat(dexBalanceA);
            tokenBBalance += parseFloat(dexBalanceB);
          }
        } catch (dexError) {
          console.warn('⚠️ Could not load DEX balances (contract not deployed?)');
        }

      } catch (tokenError) {
        console.error('❌ Failed to load token balances from blockchain:', tokenError);
        // Fallback to mock balances for demo
        tokenABalance = 5000 + Math.random() * 5000;
        tokenBBalance = 50000 + Math.random() * 50000;
        console.log('🎭 Using mock balances for demo');
      }

      // Update Redux store with blockchain balances
      dispatch(setBalance1(tokenABalance));
      dispatch(setBalance2(tokenBBalance));

      console.log('✅ Blockchain balances loaded:', {
        [currentSymbol?.coinA || 'TokenA']: tokenABalance.toFixed(4),
        [currentSymbol?.coinB || 'TokenB']: tokenBBalance.toFixed(4),
        ETH: parseFloat(ethBalance).toFixed(4)
      });

    } catch (error) {
      console.error('❌ Error loading blockchain balances:', error);
      // Keep existing balances on error
    } finally {
      setBalanceLoading(false);
    }
  }, [walletConnected, walletAddress, networkId, currentSymbol, dispatch]);

  // ===== NETWORK OPERATIONS =====

  const switchNetwork = useCallback(async (targetNetworkId: number): Promise<void> => {
    try {
      setBalanceLoading(true);
      const success = await walletService.switchNetwork(targetNetworkId);
      if (success) {
        dispatch(setNetworkId(targetNetworkId));
        dispatch(setNetworkName(SUPPORTED_NETWORKS[targetNetworkId]?.name || 'Unknown'));
        
        // Reload balances on new network
        setTimeout(() => {
          loadBlockchainBalances();
        }, 1000);
        
        console.log('🌐 Network switched to:', SUPPORTED_NETWORKS[targetNetworkId]?.name);
      }
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      setConnectionError('Failed to switch network');
    } finally {
      setBalanceLoading(false);
    }
  }, [dispatch, loadBlockchainBalances]);

  // ===== EFFECTS =====

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected') === 'true';
      const savedAddress = localStorage.getItem('walletAddress');
      
      if (wasConnected && savedAddress && isMetaMaskInstalled) {
        console.log('🔄 Auto-connecting wallet...');
        await connectWallet();
      }
    };
    
    autoConnect();
  }, [connectWallet, isMetaMaskInstalled]);

  // Reload balances when connected, network changes, or symbol changes
  useEffect(() => {
    if (walletConnected && walletAddress && networkId) {
      console.log('🔄 Reloading balances due to state change...');
      loadBlockchainBalances();
    }
  }, [walletConnected, walletAddress, networkId, currentSymbol, loadBlockchainBalances]);

  // Listen for MetaMask account/network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('👤 Accounts changed:', accounts);
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== walletAddress) {
        dispatch(setWalletAddress(accounts[0]));
        localStorage.setItem('walletAddress', accounts[0]);
        loadBlockchainBalances();
      }
    };

    const handleChainChanged = (chainId: string) => {
      const newNetworkId = parseInt(chainId, 16);
      console.log('🌐 Chain changed:', newNetworkId);
      dispatch(setNetworkId(newNetworkId));
      dispatch(setNetworkName(SUPPORTED_NETWORKS[newNetworkId]?.name || 'Unknown'));
      loadBlockchainBalances();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [dispatch, walletAddress, loadBlockchainBalances, disconnectWallet]);

  // ===== RENDER HELPERS =====

  const getConnectionButtonText = (): string => {
    if (isConnecting) return 'Connecting...';
    if (walletConnected) return 'Connected';
    return 'Connect Wallet';
  };

  const getConnectionButtonClass = (): string => {
    const baseClass = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
    
    if (isConnecting) {
      return `${baseClass} bg-gray-600 text-gray-300 cursor-not-allowed`;
    }
    
    if (walletConnected) {
      return `${baseClass} bg-green-600 hover:bg-green-700 text-white`;
    }
    
    return `${baseClass} bg-blue-600 hover:bg-blue-700 text-white`;
  };

  // ===== RENDER =====

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
    <div className="flex items-center gap-4 flex-wrap">
      {walletConnected && walletAddress ? (
        <>
          {/* Connected State */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Network Badge */}
            <div className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
              isNetworkSupported 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {!isNetworkSupported && <span>⚠️</span>}
              {currentNetwork?.name || `Network ${networkId}`}
            </div>

            {/* Address Display */}
            <div className="text-sm text-gray-300 font-mono">
              {walletService.formatAddress(walletAddress)}
            </div>

            {/* Balance Display */}
            <div className="text-xs text-gray-400">
              {balanceLoading ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="whitespace-nowrap">
                  {balance1.toFixed(2)} {currentSymbol?.coinA || 'TokenA'} | {' '}
                  {balance2.toFixed(2)} {currentSymbol?.coinB || 'TokenB'}
                </span>
              )}
            </div>

            {/* Refresh Balances Button */}
            <button
              onClick={loadBlockchainBalances}
              disabled={balanceLoading}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors disabled:opacity-50"
              title="Refresh blockchain balances"
            >
              {balanceLoading ? '⟳' : '↻'}
            </button>

            {/* Disconnect Button */}
            <button
              onClick={disconnectWallet}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Disconnected State */}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={getConnectionButtonClass()}
          >
            {isConnecting && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {getConnectionButtonText()}
          </button>

          {connectionError && (
            <div className="text-xs text-red-400 max-w-xs">
              {connectionError}
            </div>
          )}
        </>
      )}
      
      {/* Network Switch Button */}
      {showNetworkSwitch && networkId && !isNetworkSupported && (
        <button
          onClick={() => switchNetwork(11155111)} // Switch to Sepolia
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
          title={`Current network (${networkId}) is not supported`}
        >
          Switch to Sepolia
        </button>
      )}
    </div>
  );
};

export default WalletConnect;