// src/components/wallet-connect/WalletConnect.tsx - ENHANCED VERSION

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

        // Load balances
        await loadTokenBalances();

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
  }, [isMetaMaskInstalled, dispatch]);

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
    
    setConnectionError('');
    console.log('🔌 Wallet disconnected');
  }, [dispatch]);

  // ===== BALANCE MANAGEMENT =====

  const loadTokenBalances = useCallback(async (): Promise<void> => {
    if (!walletConnected || !walletAddress) return;

    try {
      setBalanceLoading(true);

      // Get ETH balance
      const ethBalance = await walletService.getETHBalance();
      console.log('💰 ETH Balance:', ethBalance);

      // Mock token balances for now (replace with real token addresses)
      const mockTokenA = '0x0000000000000000000000000000000000000000';
      const mockTokenB = '0x0000000000000000000000000000000000000000';

      let tokenABalance = 0;
      let tokenBBalance = 0;

      // Try to get real token balances if addresses are configured
      try {
        if (mockTokenA !== '0x0000000000000000000000000000000000000000') {
          const balanceA = await walletService.getTokenBalance(mockTokenA);
          tokenABalance = parseFloat(balanceA.formatted);
        } else {
          // Mock balance for testing
          tokenABalance = Math.random() * 1000;
        }

        if (mockTokenB !== '0x0000000000000000000000000000000000000000') {
          const balanceB = await walletService.getTokenBalance(mockTokenB);
          tokenBBalance = parseFloat(balanceB.formatted);
        } else {
          // Mock balance for testing  
          tokenBBalance = Math.random() * 10000;
        }
      } catch (error) {
        console.warn('Failed to load token balances, using mock data:', error);
        tokenABalance = Math.random() * 1000;
        tokenBBalance = Math.random() * 10000;
      }

      // Update Redux store
      dispatch(setBalance1(tokenABalance));
      dispatch(setBalance2(tokenBBalance));

      console.log('💰 Token balances loaded:', {
        tokenA: tokenABalance.toFixed(4),
        tokenB: tokenBBalance.toFixed(4),
        eth: parseFloat(ethBalance).toFixed(4)
      });

    } catch (error) {
      console.error('Error loading token balances:', error);
    } finally {
      setBalanceLoading(false);
    }
  }, [walletConnected, walletAddress, dispatch]);

  // ===== NETWORK OPERATIONS =====

  const switchNetwork = useCallback(async (targetNetworkId: number): Promise<void> => {
    try {
      const success = await walletService.switchNetwork(targetNetworkId);
      if (success) {
        dispatch(setNetworkId(targetNetworkId));
        dispatch(setNetworkName(SUPPORTED_NETWORKS[targetNetworkId]?.name || 'Unknown'));
        console.log('🌐 Network switched to:', SUPPORTED_NETWORKS[targetNetworkId]?.name);
      }
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      setConnectionError('Failed to switch network');
    }
  }, [dispatch]);

  // ===== EFFECTS =====

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (localStorage.getItem('walletConnected') === 'true' && isMetaMaskInstalled) {
        await connectWallet();
      }
    };
    
    autoConnect();
  }, [connectWallet, isMetaMaskInstalled]);

  // Load balances when connected or symbol changes
  useEffect(() => {
    if (walletConnected && walletAddress) {
      loadTokenBalances();
    }
  }, [walletConnected, walletAddress, currentSymbol, loadTokenBalances]);

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
    <div className="flex items-center gap-4">
      {walletConnected && walletAddress ? (
        <>
          {/* Connected State */}
          <div className="flex items-center gap-3">
            {/* Network Badge */}
            <div className={`px-2 py-1 rounded text-xs ${
              isNetworkSupported 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {currentNetwork?.name || `Network ${networkId}`}
            </div>

            {/* Address Display */}
            <div className="text-sm text-gray-300">
              {walletService.formatAddress(walletAddress)}
            </div>

            {/* Balance Display */}
            <div className="text-xs text-gray-400">
              {balanceLoading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  {balance1.toFixed(2)} {currentSymbol?.coinA || 'TokenA'} | 
                  {balance2.toFixed(2)} {currentSymbol?.coinB || 'TokenB'}
                </span>
              )}
            </div>

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
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors"
          title={`Current network (${networkId}) is not supported`}
        >
          Switch to Sepolia
        </button>
      )}

      {/* Refresh Balances Button */}
      {walletConnected && (
        <button
          onClick={loadTokenBalances}
          disabled={balanceLoading}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
          title="Refresh balances"
        >
          {balanceLoading ? '⟳' : '↻'}
        </button>
      )}
    </div>
  );
};

export default WalletConnect;