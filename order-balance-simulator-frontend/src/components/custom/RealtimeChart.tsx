import React, { useEffect, useState, useRef } from "react";
import { ISymbol } from "../../@types";
import { socketService } from "../../services/socketService";

interface RealtimeChartProps {
    symbol: ISymbol;
}

// Type for the price update data from socket
interface PriceUpdateData {
    price: number;
    timestamp: number;
}

// Type for TradingView widget configuration
interface TradingViewWidgetConfig {
    autosize: boolean;
    symbol: string;
    interval: string;
    timezone: string;
    theme: string;
    style: string;
    locale: string;
    toolbar_bg: string;
    enable_publishing: boolean;
    withdateranges: boolean;
    range: string;
    hide_side_toolbar: boolean;
    allow_symbol_change: boolean;
    details: boolean;
    hotlist: boolean;
    calendar: boolean;
    show_popup_button: boolean;
    popup_width: string;
    popup_height: string;
    container_id: string;
    studies: string[];
    overrides: Record<string, string>;
}

const RealtimeChart: React.FC<RealtimeChartProps> = ({ symbol }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [isLive, setIsLive] = useState(false);
    const initialPriceRef = useRef<number | null>(null);
    
    // Initialize TradingView Widget
    const initTradingViewWidget = (tradingSymbol: string) => {
        if (!containerRef.current) return;

        // Clear previous widget
        containerRef.current.innerHTML = '';
        
        // Create wrapper div with explicit ID
        const wrapper = document.createElement('div');
        wrapper.id = `tradingview_container_${Date.now()}`;
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        containerRef.current.appendChild(wrapper);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        
        // Determine the best exchange and symbol format for the symbol
        let exchangeSymbol = `BINANCE:${tradingSymbol}`;
        
        // Special handling for different pairs
        if (tradingSymbol === 'ETHBTC') {
            // For ETH/BTC, try multiple exchanges
            exchangeSymbol = `BINANCE:ETHBTC`;
        } else if (tradingSymbol.endsWith('BTC') && !tradingSymbol.includes('USDT')) {
            // For other BTC pairs, try Coinbase or Bitstamp
            exchangeSymbol = `COINBASE:${tradingSymbol}`;
        }
        
        console.log(`📊 Loading chart: ${exchangeSymbol} (from symbol: ${symbol.symbol})`);
        
        const config: TradingViewWidgetConfig = {
            autosize: true,
            symbol: exchangeSymbol,
            interval: "1",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#0f172a",
            enable_publishing: false,
            withdateranges: true,
            range: "1D",
            hide_side_toolbar: true,
            allow_symbol_change: false,
            details: false,
            hotlist: false,
            calendar: false,
            show_popup_button: false,
            popup_width: "1000",
            popup_height: "650",
            container_id: wrapper.id,
            studies: [],
            overrides: {
                "paneProperties.background": "#0f172a",
                "paneProperties.backgroundType": "solid",
                "scalesProperties.textColor": "#94a3b8",
                "scalesProperties.lineColor": "#334155",
                "mainSeriesProperties.candleStyle.upColor": "#22c55e",
                "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
                "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
                "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
            }
        };

        script.innerHTML = JSON.stringify(config);
        wrapper.appendChild(script);
        
        // Force resize after load
        script.onload = () => {
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
        };
    };
    
    // Initialize chart when symbol changes
    useEffect(() => {
        if (!symbol?.symbol) return;
        
        // UVEK koristi USDT parove za Chart - samo base coin se menja!
        let baseCoin = symbol.coinA || symbol.symbol.split('/')[0] || 'ETH';
        baseCoin = baseCoin.toUpperCase();
        
        // Chart uvek pokazuje BASE/USDT
        const tradingSymbol = `${baseCoin}USDT`;
        
        console.log(`📊 Chart symbol: ${baseCoin}/USDT -> ${tradingSymbol}`);
        
        // Initialize TradingView widget
        initTradingViewWidget(tradingSymbol);
        
        // Store initial price
        if (symbol.current_price) {
            initialPriceRef.current = symbol.current_price;
        } else if (symbol.price) {
            initialPriceRef.current = symbol.price;
        }
        
        // Force resize on window resize
        const handleResize = () => {
            if (containerRef.current) {
                const event = new Event('resize');
                window.dispatchEvent(event);
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbol.symbol, symbol.coinA, symbol.coinB]);
    
    // Handle real-time price updates via socket
    useEffect(() => {
        if (!symbol?.id) return;
        
        // Subscribe to price updates
        socketService.subscribeToPriceUpdates(symbol.id);
        
        // Listen for price updates from socket
        const eventName = `price_update_${symbol.id}`;
        
        // Try to get socket instance directly with proper typing
        const socket = (socketService as any).socket;
        if (socket) {
            const handlePriceUpdate = (data: PriceUpdateData) => {
                console.log(`💰 Real-time price for ${symbol.id}:`, data.price);
                setRealtimePrice(data.price);
                setIsLive(true);
                
                // Calculate price change
                if (initialPriceRef.current) {
                    const change = ((data.price - initialPriceRef.current) / initialPriceRef.current) * 100;
                    setPriceChange(change);
                }
                
                // Auto-hide live indicator after 2 seconds
                setTimeout(() => setIsLive(false), 2000);
            };
            
            socket.on(eventName, handlePriceUpdate);
            
            // Cleanup
            return () => {
                socketService.unsubscribeFromPriceUpdates(symbol.id);
                socket.off(eventName, handlePriceUpdate);
            };
        }
    }, [symbol.id]);
    
    // Format price for display
    const formatPrice = (price: number): string => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.01) return price.toFixed(6);
        if (price < 1) return price.toFixed(4);
        if (price < 100) return price.toFixed(2);
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    // Get display price - with safe fallback
    const displayPrice = realtimePrice ?? symbol.current_price ?? symbol.price ?? 0;
    
    // Get display symbol for header - uvek BASE/USDT
    const getDisplaySymbol = () => {
        const baseCoin = symbol.coinA || symbol.symbol.split('/')[0] || 'ETH';
        return `${baseCoin.toUpperCase()}/USDT`;
    };
    
    const displaySymbol = getDisplaySymbol();
    
    return (
        <div className="w-full flex flex-col border rounded-xl border-slate-500 mb-4 bg-slate-900 overflow-hidden">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <span className="font-medium text-white text-sm">RealTime Trading Chart</span>
                    
                    {/* Live pulse indicator */}
                    <div className={`transition-opacity duration-500 ${isLive ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <div className="absolute inset-0 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></div>
                            </div>
                            <span className="text-xs text-green-400">Live</span>
                        </div>
                    </div>
                </div>
                
                {/* Compact price display */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                        {displaySymbol}
                    </span>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-white">
                            ${formatPrice(displayPrice)}
                        </span>
                        
                        {priceChange !== 0 && realtimePrice && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                priceChange >= 0 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-red-500/20 text-red-400'
                            }`}>
                                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            {/* TradingView Chart Container - Using flex-grow */}
            <div className="flex-grow relative w-full" style={{ minHeight: '500px' }}>
                <div 
                    ref={containerRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    }}
                />
            </div>
        </div>
    );
};

export default RealtimeChart;