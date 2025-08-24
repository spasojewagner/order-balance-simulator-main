import React, { useState, useEffect } from 'react';
import { socketService } from '../services/socketService';
import bitcoin from '../assets/images/bitcoin.png';
import ethereum from '../assets/images/ethereum.png';
import litecoin from '../assets/images/litecoin.png';
import xrp from '../assets/images/xrp.png';

interface CryptoPrice {
  symbol: string;
  name: string;
  icon: string;
  price: number;
  change24h: number;
  isLoading: boolean;
}

interface CryptoPriceUpdate {
  symbol: string;
  price: number;
  change24h?: number;
}

const CryptoHeaderDisplay: React.FC = () => {
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice[]>([
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      icon: bitcoin,
      price: 0,
      change24h: 0,
      isLoading: true
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      icon: ethereum,
      price: 0,
      change24h: 0,
      isLoading: true
    },
    {
      symbol: 'LTC',
      name: 'Litecoin',
      icon: litecoin,
      price: 0,
      change24h: 0,
      isLoading: true
    },
    {
      symbol: 'XRP',
      name: 'Ripple',
      icon: xrp,
      price: 0,
      change24h: 0,
      isLoading: true
    }
  ]);

  useEffect(() => {
    // Connect socket
    socketService.connect();

    // Subscribe to price updates for each crypto
    const symbols = ['BTC', 'ETH', 'LTC', 'XRP'];
    symbols.forEach(symbol => {
      socketService.subscribeToPriceUpdates(symbol.toLowerCase());
    });

    // Listen for price updates
    const handlePriceUpdate = (data: CryptoPriceUpdate) => {
      setCryptoPrices(prev => prev.map(crypto => {
        if (crypto.symbol === data.symbol.toUpperCase()) {
          return {
            ...crypto,
            price: data.price,
            change24h: data.change24h || crypto.change24h,
            isLoading: false
          };
        }
        return crypto;
      }));
    };

    // Setup socket listeners for each symbol
    symbols.forEach(symbol => {
      if (socketService.socket) {
        socketService.socket.on(`price_update_${symbol.toLowerCase()}`, handlePriceUpdate);
      }
    });

    // Initial price fetch from API (fallback)
    fetchInitialPrices();

    return () => {
      // Cleanup subscriptions
      symbols.forEach(symbol => {
        socketService.unsubscribeFromPriceUpdates(symbol.toLowerCase());
        if (socketService.socket) {
          socketService.socket.off(`price_update_${symbol.toLowerCase()}`, handlePriceUpdate);
        }
      });
    };
  }, []);

  const fetchInitialPrices = async () => {
    try {
      // Fetch initial prices from Binance API
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LTCUSDT', 'XRPUSDT'];
      const symbolsString = symbols.map(s => `"${s}"`).join(',');
      
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsString}]`
      );
      const data = await response.json();

      setCryptoPrices(prev => prev.map((crypto, index) => {
        const binanceData = data[index];
        if (binanceData) {
          return {
            ...crypto,
            price: parseFloat(binanceData.lastPrice),
            change24h: parseFloat(binanceData.priceChangePercent),
            isLoading: false
          };
        }
        return crypto;
      }));
    } catch (error) {
      console.error('Error fetching initial prices:', error);
      // Set loading to false even on error
      setCryptoPrices(prev => prev.map(crypto => ({ ...crypto, isLoading: false })));
    }
  };

  const formatPrice = (price: number, symbol: string): string => {
    if (price === 0) return '$0.00';
    
    // Different precision for different coins
    if (symbol === 'BTC') {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (symbol === 'ETH') {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `$${price.toFixed(4)}`;
    }
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="flex items-center space-x-6 bg-gray-800/50 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-700">
      {cryptoPrices.map((crypto) => (
        <div key={crypto.symbol} className="flex items-center space-x-3 min-w-[140px]">
          {/* Crypto Icon */}
          <div className="relative">
            <img 
              src={crypto.icon} 
              alt={crypto.name} 
              className="w-8 h-8 rounded-full"
            />
            {crypto.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {/* Price Info */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-white font-medium text-sm">{crypto.symbol}</span>
              {!crypto.isLoading && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-white font-mono text-xs">
                {crypto.isLoading ? 'Loading...' : formatPrice(crypto.price, crypto.symbol)}
              </span>
              
              {!crypto.isLoading && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  crypto.change24h >= 0 
                    ? 'text-green-400 bg-green-400/10' 
                    : 'text-red-400 bg-red-400/10'
                }`}>
                  {formatChange(crypto.change24h)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Enhanced socket service helper for crypto prices
export const enhanceSocketServiceForCrypto = (socketService: any) => {
  const originalConnect = socketService.connect;
  
  socketService.connect = function() {
    originalConnect.call(this);
    
    if (this.socket) {
      // Listen for crypto price updates
      this.socket.on('crypto_prices', (data: any) => {
        console.log('💰 Crypto prices update:', data);
        // This will be handled by individual components
      });
      
      // Listen for individual coin updates
      this.socket.onAny((eventName: string, data: any) => {
        if (eventName.startsWith('price_update_')) {
          const coinSymbol = eventName.replace('price_update_', '').toUpperCase();
          console.log(`💰 ${coinSymbol} price update:`, data);
        }
      });
    }
  };
  
  return socketService;
};

// Usage example in main dashboard
const DashboardHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between py-4 px-6 bg-gray-900/50">
      {/* Left side - Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-light text-white">
          Ultra-Fast <span className="font-semibold">Live Charts</span>
        </h1>
      </div>
      
      {/* Center - Crypto Prices */}
      <div className="flex-1 flex justify-center mx-8">
        <CryptoHeaderDisplay />
      </div>
      
      {/* Right side - Live indicator and Wallet */}
      <div className="flex items-center space-x-4">
        {/* Live Stream Indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-400 font-semibold text-xs">STREAMING LIVE</span>
        </div>
        
        {/* Wallet Component */}
        <button className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-medium transition-colors">
          Connect Wallet
        </button>
      </div>
    </div>
  );
};

export { CryptoHeaderDisplay, DashboardHeader };
export default CryptoHeaderDisplay;