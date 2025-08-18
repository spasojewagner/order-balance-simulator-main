import React, { useEffect, useState } from "react";
import { ISymbol } from "../../@types";
import OrderBookTable from "./OrderBookTable";
import { IOrder, OrderType } from "../../@types/order";
import { useAppDispatch } from "../../store"; // PROMENI: koristi novi store
import { setCurrentSymbolPrice } from "../../store"; // PROMENI: iz novog store-a
import { OrderAPI } from "../../http"; // DODAJ: za fetch sa backend-a

interface OrderBookProps {
    symbol: ISymbol;
    onPriceSelected: (price: number) => void;
}

const OrderBook: React.FC<OrderBookProps> = ({ symbol, onPriceSelected }) => {
    const [buyData, setBuyData] = useState([]);
    const [sellData, setSellData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [useBackendData, setUseBackendData] = useState(false); // Toggle za backend/binance
    const dispatch = useAppDispatch(); // PROMENI: useAppDispatch umesto useDispatch

    // Fetch from backend matching engine
    const fetchBackendOrderBook = async () => {
        if (!symbol?.symbol) return;
        
        try {
            const response = await OrderAPI.getOrderBook(symbol.symbol.toUpperCase());
            console.log('📊 Backend order book:', response);
            
            if (response.success && response.data) {
                // Format backend data za prikaz
                const formattedBids = response.data.bids.map((bid: any) => ({
                    price: bid.price,
                    quantity: bid.amount,
                    total: bid.total || bid.price * bid.amount
                }));
                
                const formattedAsks = response.data.asks.map((ask: any) => ({
                    price: ask.price,
                    quantity: ask.amount,
                    total: ask.total || ask.price * ask.amount
                }));
                
                setBuyData(formattedBids);
                setSellData(formattedAsks);
                
                // Postavi current price od najbolje ponude
                if (formattedAsks.length > 0) {
                    const bestAsk = formattedAsks[0].price;
                    setCurrentPrice(bestAsk);
                    dispatch(setCurrentSymbolPrice(bestAsk));
                }
            }
        } catch (error) {
            console.error('Failed to fetch backend order book:', error);
        }
    };

    useEffect(() => {
        // OPCIJA 1: Koristi BACKEND matching engine podatke
        if (useBackendData) {
            // Initial fetch
            fetchBackendOrderBook();
            
            // Refresh svake 2 sekunde
            const interval = setInterval(fetchBackendOrderBook, 2000);
            
            return () => clearInterval(interval);
        } 
        // OPCIJA 2: Koristi BINANCE WebSocket (postojeći kod)
        else {
            const depthSocket = new WebSocket(`wss://stream.binance.com/stream?streams=${symbol.symbol}@depth20`);
            const tickerSocket = new WebSocket(`wss://stream.binance.com/ws/${symbol.symbol}@ticker`);

            depthSocket.onopen = () => {};
            tickerSocket.onopen = () => {};

            depthSocket.onmessage = (event: MessageEvent) => {
                let message = JSON.parse(event.data);
                message = message.data;
                setBuyData(
                    message.bids
                        .map((item: [string, string]) => {
                            const price = parseFloat(item[0]);
                            const amount = parseFloat(item[1]);
                            const total = price * amount;
                            const order: IOrder = {
                                price: price,
                                quantity: amount,
                                total: total,
                            };
                            return order;
                        })
                        .sort((a: IOrder, b: IOrder) => {
                            if (a.total > b.total) {
                                return -1;
                            } else if (a.total < b.total) {
                                return 1;
                            }
                            return 0;
                        })
                );
                setSellData(
                    message.asks
                        .map((item: [string, string]) => {
                            const price = parseFloat(item[0]);
                            const amount = parseFloat(item[1]);
                            const total = price * amount;
                            const order: IOrder = {
                                price: price,
                                quantity: amount,
                                total: total,
                            };
                            return order;
                        })
                        .sort((a: IOrder, b: IOrder) => {
                            if (a.total > b.total) {
                                return -1;
                            } else if (a.total < b.total) {
                                return 1;
                            }
                            return 0;
                        })
                );
            };

            tickerSocket.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data);
                setCurrentPrice(parseFloat(message.c));
                dispatch(setCurrentSymbolPrice(parseFloat(message.c)));
            };

            return () => {
                depthSocket.close();
                tickerSocket.close();
            };
        }
    }, [symbol.symbol, useBackendData, dispatch]);

    return (
        <div className="border-slate-500 bg-slate-900 border rounded-xl mb-4">
            <div className="w-full xl:w-auto flex-grow px-4 py-2 font-medium flex justify-between items-center">
                <span>Order Book</span>
                {/* Toggle dugme za backend/binance */}
                <button
                    onClick={() => setUseBackendData(!useBackendData)}
                    className={`text-xs px-2 py-1 rounded ${
                        useBackendData 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-600 text-gray-300'
                    }`}
                >
                    {useBackendData ? 'Your Orders' : 'Binance'}
                </button>
            </div>
            <div className="flex xl:flex-col lg:flex-row xs:flex-col justify-center">
                <div className="w-full xl:w-auto flex-grow">
                    <OrderBookTable
                        type={OrderType.Buy}
                        orderData={sellData}
                        onRowClicked={(price: number) => {
                            onPriceSelected(price);
                        }}
                    />
                </div>
                <div className="text-center py-8 xl:block hidden">
                    <span className="text-5xl">{currentPrice.toFixed(2)}</span>
                </div>
                <div className="w-full xl:w-auto flex-grow">
                    <OrderBookTable
                        type={OrderType.Sell}
                        orderData={buyData}
                        onRowClicked={(price: number) => {
                            onPriceSelected(price);
                        }}
                    />
                </div>
            </div>
            <div className="text-center py-4 xl:hidden block">
                <span className="text-4xl">{currentPrice.toFixed(2)}</span>
            </div>
        </div>
    );
};

export default OrderBook;