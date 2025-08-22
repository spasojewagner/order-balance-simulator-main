import TextInputField from "./components/pure/TextInputField";
import Select from "./components/pure/Select";
import RealtimeChart from "./components/custom/RealtimeChart";
import OrderBook from "./components/custom/OrderBook";
import TabView from "./components/pure/TabView";
import { useAppDispatch, useAppSelector, setBalance1, setBalance2, setCurrentSymbol } from "./store/index";
import { fetchOrders, cancelOrder, createOrder } from "./store/slices/orderSlice";
import { colorVariants, symbols } from "./utils/constant";
import { useState, useEffect } from "react";
import MakeOrder from "./components/custom/MakeOrder";
import OrderHistory from "./components/custom/OrderHistory";
import { OrderType, OrderStatus } from "./@types/order";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import WalletConnect from "./components/wallet-connect/WalletConnect";

import { socketService } from './services/socketService';

function App() {
    const dispatch = useAppDispatch();
    
    // State
    const [symbolIndex, setSymbolIndex] = useState(0);
    const [selectedBuyPrice, setSelectedBuyPrice] = useState(0);
    
    // Redux selectors - koristi novi store
    const tokenA = useAppSelector((state) => state.app.currentSymbol.coinA);
    const tokenB = useAppSelector((state) => state.app.currentSymbol.coinB);
    const balance1 = useAppSelector((state) => state.app.balance1);
    const balance2 = useAppSelector((state) => state.app.balance2);
    const currentSymbol = useAppSelector((state) => state.app.currentSymbol);
    const currentSymbolPrice = useAppSelector((state) => state.app.currentSymbolPrice);
    
    // Orders iz orderSlice
    const ordersState = useAppSelector((state) => state.orders);

    useEffect(() => {
        // Konektuj socket
        socketService.connect();
        
        // Initial fetch orders iz Redux
        dispatch(fetchOrders());
        
        return () => {
            socketService.disconnect();
        };
    }, [dispatch]);

    // Novi useEffect za praćenje trenutnog simbola
    useEffect(() => {
        if (currentSymbol?.symbol) {
            // UVEK koristi BASE/USDT format za socket subscriptions
            const baseCoin = currentSymbol.coinA || 'ETH';
            const normalizedSymbol = `${baseCoin.toUpperCase()}USDT`;
            
            console.log(`🔄 Subscribing to: ${normalizedSymbol} (from ${currentSymbol.symbol})`);
            
            socketService.subscribeToOrderBook(normalizedSymbol);
            
            // Subscribe to price updates for coins - use base coin ID
            const coinId = baseCoin.toLowerCase();
            socketService.subscribeToPriceUpdates(coinId);
            
            return () => {
                socketService.unsubscribeFromOrderBook(normalizedSymbol);
                socketService.unsubscribeFromPriceUpdates(coinId);
            };
        }
    }, [currentSymbol]);

    // Helper funkcije za mapiranje frontend → backend
    const getBackendOrderType = (frontendType: OrderType): string => {
        switch(frontendType) {
            case OrderType.BuyLimit: return 'Limit Buy';
            case OrderType.SellLimit: return 'Limit Sell';
            case OrderType.BuyMarket: return 'Market Buy';
            case OrderType.SellMarket: return 'Market Sell';
            default: return 'Limit Buy';
        }
    };

    const getBackendOrderStatus = (frontendStatus: OrderStatus): string => {
        switch(frontendStatus) {
            case OrderStatus.Pending: return 'Pending';
            case OrderStatus.Filled: return 'Filled';
            case OrderStatus.Canceled: return 'Cancelled';
            default: return 'Pending';
        }
    };

    // Balance check functions for different order types
    const limitBuyBalanceCheck = (price: number, percent: number) => {
        // For limit buy, calculate how much we can buy with percentage of balance2 (USDT)
        return (balance2 * percent) / 100 / price;
    };

    const limitSellBalanceCheck = (_: number, percent: number) => {
        // For limit sell, use percentage of balance1 (base currency - ETH)
        return (balance1 * percent) / 100;
    };

    const marketBuyBalanceCheck = (price: number, percent: number) => {
        // For market buy, calculate how much we can buy with percentage of balance2 (USDT)
        return (balance2 * percent) / 100 / price;
    };

    const marketSellBalanceCheck = (_: number, percent: number) => {
        // For market sell, use percentage of balance1 (base currency - ETH)
        return (balance1 * percent) / 100;
    };

    // Validation functions for different order types
    const limitBuyCheckValidity = (price: number, quantity: number) => {
        const total = price * quantity;
        return price > 0 && quantity > 0 && total <= balance2;
    };

    const limitSellCheckValidity = (price: number, quantity: number) => {
        return price > 0 && quantity > 0 && quantity <= balance1;
    };

    const marketBuyCheckValidity = (price: number, quantity: number) => {
        const total = price * quantity;
        return price > 0 && quantity > 0 && total <= balance2;
    };

    const marketSellCheckValidity = (price: number, quantity: number) => {
        return price > 0 && quantity > 0 && quantity <= balance1;
    };

    const addOrder = async ({ type, symbol, price, quantity, total, status }: any) => {
        try {
            console.log('🚀 Frontend order data:', { type, symbol, price, quantity, total, status });
            
            // Konvertuj symbol u BASE/USDT format za backend
            const baseCoin = currentSymbol.coinA || 'ETH';
            const backendSymbol = `${baseCoin.toUpperCase()}/USDT`;
            
            // Mapiraj frontend → backend format
            const backendOrderData = {
                pair: backendSymbol, // uvek BASE/USDT
                type: getBackendOrderType(type), 
                price: Number(price),
                amount: Number(quantity), 
                status: getBackendOrderStatus(status)
            };

            console.log('🚀 Sending to backend:', backendOrderData);
            
            // Pošalji na backend
            await dispatch(createOrder(backendOrderData)).unwrap();
            
            // Toast za market ordere
            if (type === OrderType.BuyMarket || type === OrderType.SellMarket) {
                toast.success("Successfully Filled!", { position: "top-center" });
            } else {
                toast.success("Order placed successfully!", { position: "top-center" });
            }
            
            // Refresh orders
            dispatch(fetchOrders());
            
        } catch (error: any) {
            console.error('❌ Failed to create order:', error);
            
            // Detaljniji error handling
            let errorMessage = "Failed to create order!";
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            toast.error(errorMessage, { position: "top-center" });
        }
    };

    const handleCancelOrder = async (id: string) => {
        try {
            await dispatch(cancelOrder(id)).unwrap();
            toast.success("Successfully Canceled!", { position: "top-center" });
            // Refresh orders
            dispatch(fetchOrders());
        } catch (error: any) {
            console.error('Failed to cancel order:', error);
            toast.error("Failed to cancel order!", { position: "top-center" });
        }
    };

    // Get display symbol for UI - uvek BASE/USDT
    const getDisplaySymbol = () => {
        const baseCoin = currentSymbol.coinA || 'ETH';
        return `${baseCoin.toUpperCase()}/USDT`;
    };

    return (
        <>
            <div className="min-w-full bg-slate-950 min-h-svh pt-10">
                <div className="container mx-auto">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl text-left">Order Trading Platform</h2>
                        <WalletConnect />
                    </div>
                    <div className="flex flex-wrap flex-col justify-between items-center gap-4 mt-4 xl:flex-row">
                        <Select
                            onChange={(value: number | string) => {
                                dispatch(setCurrentSymbol(symbols[value as number].symbol));
                                setSymbolIndex(value as number);
                            }}
                            options={symbols.map((item, index) => {
                                // Prikaz uvek kao BASE/USDT
                                const baseCoin = item.coinA || 'ETH';
                                return {
                                    label: `${baseCoin}/USDT`,
                                    value: index,
                                };
                            })}
                            value={symbolIndex}
                        ></Select>
                        <div className="flex-grow"></div>
                        <span className="text-gray-500 ">Input your balance:</span>
                        <TextInputField
                            prefix="Balance"
                            type="number"
                            suffix={tokenA || 'ETH'}
                            value={balance1}
                            onChange={(value) => {
                                dispatch(setBalance1(parseFloat(value as string)));
                            }}
                        />
                        <TextInputField
                            prefix="Balance"
                            type="number"
                            suffix="USDT"
                            value={balance2}
                            onChange={(value) => {
                                dispatch(setBalance2(parseFloat(value as string)));
                            }}
                        />
                    </div>
                    <div className="flex flex-row py-2 justify-end items-start text-gray-500">
                        <h4 className="pr-16">This website is test website and all of data is mock data. Please be aware of it.</h4>
                    </div>
                    <div className="flex justify-between items-center flex-col-reverse xl:flex-row xl:items-start gap-4">
                        <div className="w-full xl:flex-1">
                            <OrderBook
                                symbol={currentSymbol}
                                onPriceSelected={(price: number) => {
                                    setSelectedBuyPrice(price as number);
                                }}
                            ></OrderBook>
                        </div>
                        <div className="xl:flex-grow w-full">
                            <RealtimeChart symbol={currentSymbol}></RealtimeChart>
                            <div className="flex-col">
                                <div className="flex-row items-center">
                                    <TabView
                                        tabs={[
                                            {
                                                label: "Limit",
                                                child: (
                                                    <div className="flex md:flex-row gap-10 flex-col">
                                                        <MakeOrder
                                                            symbol={currentSymbol}
                                                            defaultPrice={selectedBuyPrice}
                                                            isMarket={false}
                                                            buttonLabel={`BUY ${currentSymbol.coinA || 'ETH'}`}
                                                            balance1={balance1}
                                                            balance2={balance2}
                                                            balanceCheck={limitBuyBalanceCheck}
                                                            checkValidity={limitBuyCheckValidity}
                                                            onSubmitted={(price: number, quantity: number) => {
                                                                addOrder({ 
                                                                    type: OrderType.BuyLimit, 
                                                                    price, 
                                                                    quantity, 
                                                                    total: price * quantity, 
                                                                    status: OrderStatus.Pending, 
                                                                    symbol: getDisplaySymbol()
                                                                });
                                                            }}
                                                            customStyle={colorVariants.blue}
                                                        ></MakeOrder>
                                                        <MakeOrder
                                                            symbol={currentSymbol}
                                                            defaultPrice={selectedBuyPrice}
                                                            isMarket={false}
                                                            buttonLabel={`SELL ${currentSymbol.coinA || 'ETH'}`}
                                                            balance1={balance1}
                                                            balance2={balance2}
                                                            balanceCheck={limitSellBalanceCheck}
                                                            checkValidity={limitSellCheckValidity}
                                                            onSubmitted={(price: number, quantity: number) => {
                                                                addOrder({ 
                                                                    type: OrderType.SellLimit, 
                                                                    price, 
                                                                    quantity, 
                                                                    total: price * quantity, 
                                                                    status: OrderStatus.Pending, 
                                                                    symbol: getDisplaySymbol()
                                                                });
                                                            }}
                                                            customStyle={colorVariants.red}
                                                        ></MakeOrder>
                                                    </div>
                                                ),
                                            },
                                            {
                                                label: "Market",
                                                child: (
                                                    <div className="flex md:flex-row gap-10 flex-col">
                                                        <MakeOrder
                                                            symbol={currentSymbol}
                                                            defaultPrice={currentSymbolPrice}
                                                            isMarket={true}
                                                            buttonLabel={`BUY ${currentSymbol.coinA || 'ETH'}`}
                                                            balance1={balance1}
                                                            balance2={balance2}
                                                            balanceCheck={marketBuyBalanceCheck}
                                                            checkValidity={marketBuyCheckValidity}
                                                            onSubmitted={(price: number, quantity: number) => {
                                                                addOrder({ 
                                                                    type: OrderType.BuyMarket, 
                                                                    price, 
                                                                    quantity, 
                                                                    total: price * quantity, 
                                                                    status: OrderStatus.Filled, 
                                                                    symbol: getDisplaySymbol()
                                                                });
                                                            }}
                                                            customStyle={colorVariants.blue}
                                                        ></MakeOrder>
                                                        <MakeOrder
                                                            symbol={currentSymbol}
                                                            defaultPrice={currentSymbolPrice}
                                                            isMarket={true}
                                                            balance1={balance1}
                                                            balance2={balance2}
                                                            balanceCheck={marketSellBalanceCheck}
                                                            buttonLabel={`SELL ${currentSymbol.coinA || 'ETH'}`}
                                                            checkValidity={marketSellCheckValidity}
                                                            onSubmitted={(price: number, quantity: number) => {
                                                                addOrder({ 
                                                                    type: OrderType.SellMarket, 
                                                                    price, 
                                                                    quantity, 
                                                                    total: price * quantity, 
                                                                    status: OrderStatus.Filled, 
                                                                    symbol: getDisplaySymbol()
                                                                });
                                                            }}
                                                            customStyle={colorVariants.red}
                                                        ></MakeOrder>
                                                    </div>
                                                ),
                                            },
                                        ]}
                                    ></TabView>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pb-8 mt-4">
                        <OrderHistory />
                    </div>
                 
                </div>
            </div>
            <ToastContainer />
        </>
    );
}

export default App;