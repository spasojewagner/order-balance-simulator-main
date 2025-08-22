import React, { useEffect, useCallback, useMemo } from "react";
import { format, isValid, parseISO } from "date-fns";
import { OrderStatus, orderStatusLabel, orderTypeLabel, OrderType } from "../../@types/order";
import { useAppDispatch, useAppSelector } from "../../store";
import { fetchOrders, cancelOrder } from "../../store/slices/orderSlice";

export interface OrderHistoryProps {}

// Utility funkcija za safe parsiranje datuma
const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    try {
        if (dateValue instanceof Date) {
            return isValid(dateValue) ? dateValue : null;
        }
        
        if (typeof dateValue === 'string') {
            const parsed = parseISO(dateValue);
            return isValid(parsed) ? parsed : new Date(dateValue);
        }
        
        if (typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            return isValid(parsed) ? parsed : null;
        }
        
        return null;
    } catch (error) {
        console.warn('Failed to parse date:', dateValue, error);
        return null;
    }
};

// Utility funkcija za safe broj parsing
const parseNumber = (value: any, defaultValue: number = 0): number => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    
    return defaultValue;
};

// ISPRAVLJENA funkcija za dobijanje labele tipa ordera
const getOrderTypeLabel = (item: any): string => {
    // Pokušaj da uzmeš type iz različitih mesta
    const type = item?.order?.type ?? item?.type;
    
    // Ako je type number (enum value), koristi label mapping
    if (typeof type === 'number') {
        return orderTypeLabel[type as OrderType] || 'Unknown';
    }
    
    // Ako je type string (iz backend-a), vrati ga direktno
    if (typeof type === 'string') {
        return type;
    }
    
    return 'N/A';
};

// Error Boundary komponenta
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OrderHistory Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900 text-white p-4 rounded">
          <h2>Something went wrong in OrderHistory component</h2>
          <details className="mt-2">
            <summary>Error details</summary>
            <pre className="mt-2 text-xs overflow-auto">
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            className="mt-2 bg-blue-600 px-4 py-2 rounded"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const OrderHistoryContent: React.FC<OrderHistoryProps> = () => {
    const dispatch = useAppDispatch();
    
    // Redux selektori sa error handling
    const ordersState = useAppSelector((state) => {
        try {
            return state.orders;
        } catch (error) {
            console.error('Error accessing orders state:', error);
            return null;
        }
    });
    
    // Jednostavno pristupanje podacima
    const orders = useMemo(() => {
        try {
            const rawOrders = ordersState?.orders || [];
            
            if (Array.isArray(rawOrders) && rawOrders.length > 0) {
                return rawOrders;
            }
            
            return [];
        } catch (error) {
            console.error('Error processing orders:', error);
            return [];
        }
    }, [ordersState?.orders]);

    const loading = useMemo(() => {
        try {
            return ordersState?.loading || {
                orders: false,
                create: false,
                cancel: false,
                delete: false,
                stats: false
            };
        } catch (error) {
            console.error('Error accessing loading state:', error);
            return {
                orders: false,
                create: false,
                cancel: false,
                delete: false,
                stats: false
            };
        }
    }, [ordersState?.loading]);
    
    const error = ordersState?.error || null;

    // Fetch function sa error handling
    const fetchOrdersCallback = useCallback(async () => {
        if (loading.orders) return;
        
        try {
            await dispatch(fetchOrders({})).unwrap();
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        }
    }, [dispatch, loading.orders]);

    // Cancel order handler
    const handleCancelOrder = useCallback(async (id: string) => {
        if (!id || loading.cancel) return;
        
        try {
            await dispatch(cancelOrder(id)).unwrap();
            
            // Refresh nakon cancel
            setTimeout(() => {
                fetchOrdersCallback();
            }, 1000);
        } catch (error) {
            console.error('Failed to cancel order:', error);
        }
    }, [dispatch, fetchOrdersCallback, loading.cancel]);

    // Initial fetch
    useEffect(() => {
        fetchOrdersCallback();
    }, []);

    // Loading state
    if (loading.orders) {
        return (
            <div className="bg-slate-900">
                <div className="px-4 py-2 font-medium border border-slate-500 rounded-t-xl">Order History</div>
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                    <p className="mt-2 text-slate-400">Loading orders...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-slate-900">
                <div className="px-4 py-2 font-medium border border-slate-500 rounded-t-xl">Order History</div>
                <div className="p-8 text-center">
                    <p className="text-red-400 mb-4">
                        {typeof error === 'string' ? error : 'An error occurred while loading orders'}
                    </p>
                    <button 
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                        onClick={fetchOrdersCallback}
                        disabled={loading.orders}
                    >
                        {loading.orders ? 'Loading...' : 'Retry'}
                    </button>
                </div>
            </div>
        );
    }

    // Empty state
    if (!orders || orders.length === 0) {
        return (
            <div className="bg-slate-900">
                <div className="px-4 py-2 font-medium border border-slate-500 rounded-t-xl">Order History</div>
                <div className="p-8 text-center">
                    <p className="text-slate-400 mb-4">No orders found</p>
                    <button 
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition-colors"
                        onClick={fetchOrdersCallback}
                        disabled={loading.orders}
                    >
                        {loading.orders ? 'Loading...' : 'Load Orders'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900">
            <div className="px-4 py-2 font-medium border border-slate-500 rounded-t-xl flex justify-between items-center">
                <span>Order History ({orders.length})</span>
                <div className="flex items-center gap-2">
                    <button 
                        className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"
                        onClick={fetchOrdersCallback}
                        disabled={loading.orders}
                    >
                        {loading.orders ? '...' : 'Refresh'}
                    </button>
                    {loading.cancel && (
                        <span className="text-sm text-yellow-400">Canceling...</span>
                    )}
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="text-center rounded-xl text-md border-collapse w-full bg-slate-900 min-w-full">
                    <thead>
                        <tr className="border border-slate-500 rounded-xl">
                            <th className="py-3 font-medium border border-slate-500">No</th>
                            <th className="py-3 font-medium border border-slate-500">Pair</th>
                            <th className="py-3 font-medium border border-slate-500">Type</th>
                            <th className="py-3 font-medium border border-slate-500">Price</th>
                            <th className="py-3 font-medium border border-slate-500">Amount</th>
                            <th className="py-3 font-medium border border-slate-500 hidden lg:table-cell">Total</th>
                            <th className="py-3 font-medium border border-slate-500 min-w-48 hidden sm:table-cell">Order Time</th>
                            <th className="py-3 font-medium border border-slate-500 hidden lg:table-cell">Filled Time</th>
                            <th className="py-3 font-medium border border-slate-500">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((item, index) => (
                            <OrderRow 
                                key={item._id || `order-${index}`} 
                                item={item} 
                                index={index} 
                                onCancel={handleCancelOrder}
                                cancelLoading={loading.cancel}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Optimizovana OrderRow komponenta - ISPRAVLJENA
const OrderRow = React.memo<{
    item: any;
    index: number;
    onCancel: (id: string) => void;
    cancelLoading: boolean;
}>(({ item, index, onCancel, cancelLoading }) => {
    const handleCancel = useCallback(() => {
        if (item?._id && !cancelLoading) {
            onCancel(item._id);
        }
    }, [item?._id, onCancel, cancelLoading]);

    // Fleksibilno pristupanje podacima sa boljim type handling
    const symbol = item?.order?.symbol || item?.pair || 'N/A';
    const typeLabel = getOrderTypeLabel(item);
    const price = parseNumber(item?.order?.price || item?.price);
    const quantity = parseNumber(item?.order?.quantity || item?.amount);
    const total = parseNumber(item?.order?.total || item?.total);
    const status = item?.status || OrderStatus.Pending;
    const orderNumber = item?.no || index + 1;
    
    // Safe date parsing - podržava oba formata
    const createdDate = parseDate(item?.created || item?.orderTime) || new Date();
    const completedDate = parseDate(item?.completed || item?.filledTime);

    // Dobij status vrednost (handle i enum i string)
    const statusValue = typeof status === 'number' ? status : 
        status === 'Filled' ? OrderStatus.Filled :
        status === 'Cancelled' || status === 'Canceled' ? OrderStatus.Canceled :
        OrderStatus.Pending;

    return (
        <tr className="table-row border hover:bg-slate-600 border-slate-500 bg-slate-900 transition-colors">
            <td className="py-2 px-4 border border-slate-500">{orderNumber}</td>
            <td className="py-2 px-4 border border-slate-500 font-mono">{symbol.toUpperCase()}</td>
            <td className="py-2 px-4 border border-slate-500">{typeLabel}</td>
            <td className="py-2 px-4 border border-slate-500 font-mono">{price.toFixed(3)}</td>
            <td className="py-2 px-4 border border-slate-500 font-mono">{quantity.toFixed(3)}</td>
            <td className="py-2 px-4 border border-slate-500 font-mono hidden lg:table-cell">{total.toFixed(3)}</td>
            <td className="py-2 px-4 border hidden sm:table-cell border-slate-500 font-mono text-xs">
                {format(createdDate, "yyyy/MM/dd HH:mm:ss")}
            </td>
            <td className="py-2 px-4 border border-slate-500 font-mono text-xs hidden lg:table-cell">
                {completedDate ? format(completedDate, "yyyy/MM/dd HH:mm:ss") : "-"}
            </td>
            <td className="py-2 px-4 border border-slate-500">
                {statusValue === OrderStatus.Pending ? (
                    <button
                        className="bg-red-900 px-2 xl:w-24 py-1 hover:bg-red-700 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                        disabled={cancelLoading}
                        onClick={handleCancel}
                    >
                        {cancelLoading ? "..." : "Cancel"}
                    </button>
                ) : statusValue === OrderStatus.Canceled ? (
                    <div className="bg-yellow-900 px-2 xl:w-24 py-1 rounded-full inline-block text-xs">
                        {orderStatusLabel[statusValue] || 'Cancelled'}
                    </div>
                ) : (
                    <div className="bg-green-900 px-2 xl:w-24 py-1 rounded-full inline-block text-xs">
                        {orderStatusLabel[statusValue] || 'Filled'}
                    </div>
                )}
            </td>
        </tr>
    );
});

OrderRow.displayName = 'OrderRow';

const OrderHistory: React.FC<OrderHistoryProps> = () => {
    return (
        <ErrorBoundary>
            <OrderHistoryContent />
        </ErrorBoundary>
    );
};

export default OrderHistory;