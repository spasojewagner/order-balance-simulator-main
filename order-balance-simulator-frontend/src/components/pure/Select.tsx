import React, { useState, useEffect, useRef } from 'react';
import { socketService } from '../../services/socketService';
import { ISymbol } from '../../@types';
import bitcoin from '../../assets/images/bitcoin.png';
import ethereum from '../../assets/images/ethereum.png';
import litecoin from '../../assets/images/litecoin.png';
import xrp from '../../assets/images/xrp.png';

interface CryptoPrice {
  symbol: string;
  name: string;
  icon: string;
  price: number;
  change24h: number;
  isLoading: boolean;
}

interface StyledCryptoSelectorProps {
  symbols: ISymbol[];
  value: number;
  onChange: (value: number) => void;
  currentSymbol: ISymbol;
}

const StyledCryptoSelector: React.FC<StyledCryptoSelectorProps> = ({ 
  symbols, 
  value, 
  onChange,
  currentSymbol 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // Fetch prices from Binance API
  const fetchPrices = async () => {
    try {
      const binanceSymbols = ['BTCUSDT', 'ETHUSDT', 'LTCUSDT', 'XRPUSDT'];
      
      // Fetch all prices in parallel
      const promises = binanceSymbols.map(symbol => 
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
          .then(res => res.json())
      );
      
      const results = await Promise.all(promises);
      
      setCryptoPrices(prev => prev.map((crypto, index) => {
        const data = results[index];
        if (data && !data.code) { // Check if data is valid (no error code)
          return {
            ...crypto,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            isLoading: false
          };
        }
        return crypto;
      }));
    } catch (error) {
      console.error('Error fetching prices:', error);
      // Try alternative method
      fetchAlternativePrices();
    }
  };

  // Alternative method using batch request
  const fetchAlternativePrices = async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const allData = await response.json();
      
      const symbolMap: Record<string, any> = {
        'BTCUSDT': 'BTC',
        'ETHUSDT': 'ETH',
        'LTCUSDT': 'LTC',
        'XRPUSDT': 'XRP'
      };
      
      setCryptoPrices(prev => prev.map(crypto => {
        const binanceSymbol = `${crypto.symbol}USDT`;
        const data = allData.find((item: any) => item.symbol === binanceSymbol);
        
        if (data) {
          return {
            ...crypto,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            isLoading: false
          };
        }
        return crypto;
      }));
    } catch (error) {
      console.error('Alternative fetch failed:', error);
      setCryptoPrices(prev => prev.map(crypto => ({ ...crypto, isLoading: false })));
    }
  };

  // Setup real-time updates
  useEffect(() => {
    // Initial fetch
    fetchPrices();
    
    // Setup polling every 5 seconds for price updates
    intervalRef.current = setInterval(() => {
      fetchPrices();
    }, 5000);
    
    // Socket listeners for real-time updates (if available)
    const cryptoSymbols = ['btc', 'eth', 'ltc', 'xrp'];
    
    const handlePriceUpdate = (symbol: string) => (data: any) => {
      setCryptoPrices(prev => prev.map(crypto => {
        if (crypto.symbol.toLowerCase() === symbol) {
          return {
            ...crypto,
            price: data.price || crypto.price,
            change24h: data.change24h !== undefined ? data.change24h : crypto.change24h,
            isLoading: false
          };
        }
        return crypto;
      }));
    };
    
    // Subscribe to socket events
    cryptoSymbols.forEach(symbol => {
      if (socketService.socket) {
        socketService.socket.on(`price_update_${symbol}`, handlePriceUpdate(symbol));
        socketService.socket.on(`${symbol}_price`, handlePriceUpdate(symbol));
      }
    });
    
    return () => {
      // Cleanup interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Cleanup socket listeners
      cryptoSymbols.forEach(symbol => {
        if (socketService.socket) {
          socketService.socket.off(`price_update_${symbol}`);
          socketService.socket.off(`${symbol}_price`);
        }
      });
    };
  }, []);

  const formatPrice = (price: number, symbol: string): string => {
    if (price === 0) return '$0.00';
    
    if (symbol === 'BTC' || symbol === 'ETH') {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (symbol === 'XRP') {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(3)}`;
    }
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.crypto-selector-container')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3 border border-slate-500 w-full">
      {/* Crypto Prices Display */}
      <div className="flex items-center space-x-4 xl:space-x-6 flex-1 overflow-x-auto">
        {cryptoPrices.map((crypto) => (
          <div 
            key={crypto.symbol} 
            className={`flex items-center space-x-2 xl:space-x-3 min-w-[120px] xl:min-w-[140px] ${
              currentSymbol?.coinA === crypto.symbol ? 'opacity-100' : 'opacity-70'
            } hover:opacity-100 transition-opacity cursor-pointer`}
            onClick={() => {
              // Find and select the pair with this crypto
              const index = symbols.findIndex(s => s.coinA === crypto.symbol);
              if (index !== -1) {
                onChange(index);
              }
            }}
          >
            {/* Crypto Icon */}
            <div className="relative">
              <img 
                src={crypto.icon} 
                alt={crypto.name} 
                className="w-7 h-7 xl:w-8 xl:h-8 rounded-full"
              />
              {crypto.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            {/* Price Info */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-1 xl:space-x-2">
                <span className="text-white font-medium text-xs xl:text-sm">{crypto.symbol}</span>
                {!crypto.isLoading && currentSymbol?.coinA === crypto.symbol && (
                  <div className="w-1.5 h-1.5 xl:w-2 xl:h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </div>
              
              <div className="flex items-center space-x-1 xl:space-x-2">
                <span className="text-white font-mono text-xs">
                  {crypto.isLoading ? 'Loading...' : formatPrice(crypto.price, crypto.symbol)}
                </span>
                
                {!crypto.isLoading && (
                  <span className={`text-xs font-medium px-1 xl:px-1.5 py-0.5 rounded ${
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
      
      {/* Trading Pair Selector - zadržava istu funkcionalnost */}
      <div className="relative ml-4 xl:ml-6 crypto-selector-container">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 px-3 xl:px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-600 text-sm xl:text-base"
        >
          <span className="text-white font-medium">
            {currentSymbol?.coinA || 'BTC'}/{currentSymbol?.coinB || 'USDT'}
          </span>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-600 z-50">
            {symbols.map((symbol, index) => (
              <button
                key={symbol.symbol}
                onClick={() => {
                  onChange(index);
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  index === value ? 'bg-slate-700 text-green-400' : 'text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{symbol.coinA}/{symbol.coinB}</span>
                  {index === value && (
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyledCryptoSelector;