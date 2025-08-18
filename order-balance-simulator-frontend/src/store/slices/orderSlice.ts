// orderSlice.ts - CLEAN VERSION
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  IOrder,
  IOrderHistory,
  OrderFilters,
  CreateOrderRequest,
  OrderType,
  OrderStatus,
  OrdersResponse,
  OrderStatsResponse
} from "../../@types/order";
import { OrderAPI } from '../../http/index';

// Helper za konverziju backend → frontend formata
const convertToOrderHistory = (backendOrder: IOrder): IOrderHistory => {
  let frontendType: OrderType;
  
  // Mapiranje tipova ordера sa case-insensitive poređenjem
  const orderType = (backendOrder.type || '').toLowerCase().trim();
  
  switch (orderType) {
    // Limit Sell variations
    case 'limit sell':
    case 'limitsell':
    case 'sell_limit':
    case 'sell limit':
    case 'limit_sell':
      frontendType = OrderType.SellLimit;
      break;
    
    // Limit Buy variations
    case 'limit buy':
    case 'limitbuy':
    case 'buy_limit':
    case 'buy limit':
    case 'limit_buy':
      frontendType = OrderType.BuyLimit;
      break;
    
    // Market Buy variations
    case 'market buy':
    case 'marketbuy':
    case 'buy_market':
    case 'buy market':
    case 'market_buy':
      frontendType = OrderType.BuyMarket;
      break;
    
    // Market Sell variations
    case 'market sell':
    case 'marketsell':
    case 'sell_market':
    case 'sell market':
    case 'market_sell':
      frontendType = OrderType.SellMarket;
      break;
    
    default:
      // Inteligentno detektovanje tipa na osnovu ključnih reči
      const hasBuy = orderType.includes('buy');
      const hasSell = orderType.includes('sell');
      const hasLimit = orderType.includes('limit');
      const hasMarket = orderType.includes('market');
      
      if (hasBuy && hasLimit) {
        frontendType = OrderType.BuyLimit;
      } else if (hasSell && hasLimit) {
        frontendType = OrderType.SellLimit;
      } else if (hasBuy && hasMarket) {
        frontendType = OrderType.BuyMarket;
      } else if (hasSell && hasMarket) {
        frontendType = OrderType.SellMarket;
      } else if (hasBuy) {
        frontendType = OrderType.BuyLimit;
      } else if (hasSell) {
        frontendType = OrderType.SellLimit;
      } else {
        // Analiza na osnovu cene
        const price = Number(backendOrder.price) || 0;
        if (price === 0 || price < 1) {
          frontendType = OrderType.BuyMarket;
        } else {
          frontendType = OrderType.BuyLimit;
        }
      }
      break;
  }

  // Status mapiranje
  let frontendStatus: OrderStatus;
  const orderStatus = (backendOrder.status || '').toLowerCase().trim();
  
  switch (orderStatus) {
    case 'filled':
    case 'completed':
    case 'executed':
      frontendStatus = OrderStatus.Filled;
      break;
    case 'cancelled':
    case 'canceled':
      frontendStatus = OrderStatus.Canceled;
      break;
    case 'pending':
    case 'open':
    case 'active':
      frontendStatus = OrderStatus.Pending;
      break;
    default:
      frontendStatus = OrderStatus.Pending;
      break;
  }

  const convertedOrder: IOrderHistory = {
    _id: backendOrder._id,
    order: {
      symbol: (backendOrder.pair || 'unknown').toLowerCase(),
      type: frontendType,
      price: Number(backendOrder.price) || 0,
      quantity: Number(backendOrder.amount) || 0,
      total: Number(backendOrder.total) || 0
    },
    status: frontendStatus,
    created: backendOrder.orderTime ? new Date(backendOrder.orderTime) : new Date(),
    completed: backendOrder.filledTime ? new Date(backendOrder.filledTime) : undefined
  };

  return convertedOrder;
};

// === Thunks ===
export const fetchOrders = createAsyncThunk<
  IOrderHistory[],
  OrderFilters | undefined,
  { rejectValue: string }
>(
  'orders/fetchOrders',
  async (filters: OrderFilters | undefined = {}, { rejectWithValue }) => {
    try {
      const response = await OrderAPI.getAllOrders(filters);
      
      if (!response || !response.data || !response.data.orders) {
        return rejectWithValue('Invalid response structure');
      }
      
      const orders = response.data.orders;
      const convertedOrders: IOrderHistory[] = [];
      
      for (const order of orders) {
        try {
          const converted = convertToOrderHistory(order);
          convertedOrders.push(converted);
        } catch (err) {
          // Skip failed conversions silently
        }
      }
      
      return convertedOrders;
      
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const createOrder = createAsyncThunk<IOrder, CreateOrderRequest, { rejectValue: string }>(
  'orders/createOrder',
  async (orderData, { rejectWithValue }) => {
    try {
      console.log('🚀 Creating order:', {
        type: orderData.type,
        symbol: orderData.symbol,
        price: orderData.price,
        quantity: orderData.quantity
      });
      
      const response = await OrderAPI.createOrder(orderData);
      
      console.log('✅ Order created successfully:', {
        orderId: response.data._id,
        type: response.data.type,
        status: response.data.status
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Create order failed:', error.response?.data?.message || error.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to create order');
    }
  }
);

export const cancelOrder = createAsyncThunk<IOrder, string, { rejectValue: string }>(
  'orders/cancelOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await OrderAPI.cancelOrder(orderId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel order');
    }
  }
);

export const deleteOrder = createAsyncThunk<string, string, { rejectValue: string }>(
  'orders/deleteOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      await OrderAPI.deleteOrder(orderId);
      return orderId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete order');
    }
  }
);

export const fetchOrderStats = createAsyncThunk<OrderStatsResponse, void, { rejectValue: string }>(
  'orders/fetchOrderStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await OrderAPI.getOrdersSummary();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch order stats');
    }
  }
);

export const fetchVolumeStats = createAsyncThunk<
  { pair: string; stats: any },
  string,
  { rejectValue: string }
>(
  'orders/fetchVolumeStats',
  async (pair, { rejectWithValue }) => {
    try {
      const response = await OrderAPI.getVolumeStats(pair);
      return { pair, stats: response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch volume stats');
    }
  }
);

// === State ===
export interface OrderState {
  orders: IOrderHistory[];
  rawOrders: IOrder[];
  currentOrder: IOrder | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  } | null;
  stats: {
    totalOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    topPairs: Array<{
      _id: string;
      totalOrders: number;
      totalVolume: number;
      avgPrice: number;
    }>;
  } | null;
  volumeStats: Record<string, any>;
  filters: OrderFilters;
  loading: {
    orders: boolean;
    create: boolean;
    cancel: boolean;
    delete: boolean;
    stats: boolean;
  };
  error: string | null;
}

const initialState: OrderState = {
  orders: [],
  rawOrders: [],
  currentOrder: null,
  pagination: null,
  stats: null,
  volumeStats: {},
  filters: {
    page: 1,
    limit: 20,
    sortBy: 'orderTime',
    sortOrder: 'desc'
  },
  loading: {
    orders: false,
    create: false,
    cancel: false,
    delete: false,
    stats: false
  },
  error: null
};

// === Slice ===
const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<OrderFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearError: (state) => {
      state.error = null;
    },
    setCurrentOrder: (state, action: PayloadAction<IOrder | null>) => {
      state.currentOrder = action.payload;
    },
    updateOrderRealTime: (state, action: PayloadAction<IOrder>) => {
      const updatedOrder = action.payload;
      const index = state.rawOrders.findIndex(order => order._id === updatedOrder._id);

      if (index !== -1) {
        state.rawOrders[index] = updatedOrder;
        state.orders[index] = convertToOrderHistory(updatedOrder);
      } else {
        state.rawOrders.unshift(updatedOrder);
        state.orders.unshift(convertToOrderHistory(updatedOrder));
      }
    },
    removeOrderRealTime: (state, action: PayloadAction<string>) => {
      const orderId = action.payload;
      state.rawOrders = state.rawOrders.filter(order => order._id !== orderId);
      state.orders = state.orders.filter(order => order._id !== orderId);
    }
  },
  extraReducers: (builder) => {
    builder
      // === Fetch Orders ===
      .addCase(fetchOrders.pending, (state) => {
        state.loading.orders = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading.orders = false;
        state.error = null;

        if (Array.isArray(action.payload)) {
          state.orders = action.payload;
        } else {
          state.error = 'Invalid data format received';
          state.orders = [];
        }
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading.orders = false;
        state.error = action.payload || 'Unknown error';
        state.orders = [];
        state.rawOrders = [];
      })

      // === Create Order ===
      .addCase(createOrder.pending, (state) => {
        state.loading.create = true;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading.create = false;
        
        state.rawOrders.unshift(action.payload);
        const convertedNewOrder = convertToOrderHistory(action.payload);
        state.orders.unshift(convertedNewOrder);
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading.create = false;
        state.error = action.payload || 'Failed to create order';
      })

      // === Cancel Order ===
      .addCase(cancelOrder.pending, (state) => {
        state.loading.cancel = true;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.loading.cancel = false;
        const index = state.rawOrders.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.rawOrders[index] = action.payload;
          state.orders[index] = convertToOrderHistory(action.payload);
        }
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.loading.cancel = false;
        state.error = action.payload || 'Failed to cancel order';
      })

      // === Delete Order ===
      .addCase(deleteOrder.pending, (state) => {
        state.loading.delete = true;
      })
      .addCase(deleteOrder.fulfilled, (state, action) => {
        state.loading.delete = false;
        state.rawOrders = state.rawOrders.filter(order => order._id !== action.payload);
        state.orders = state.orders.filter(order => order._id !== action.payload);
      })
      .addCase(deleteOrder.rejected, (state, action) => {
        state.loading.delete = false;
        state.error = action.payload || 'Failed to delete order';
      })

      // === Stats ===
      .addCase(fetchOrderStats.pending, (state) => {
        state.loading.stats = true;
      })
      .addCase(fetchOrderStats.fulfilled, (state, action) => {
        state.loading.stats = false;
        state.stats = action.payload.data;
      })
      .addCase(fetchOrderStats.rejected, (state, action) => {
        state.loading.stats = false;
        state.error = action.payload || 'Failed to fetch stats';
      })

      // === Volume Stats ===
      .addCase(fetchVolumeStats.fulfilled, (state, action) => {
        const { pair, stats } = action.payload;
        state.volumeStats[pair] = stats;
      });
  }
});

export const {
  setFilters,
  clearFilters,
  clearError,
  setCurrentOrder,
  updateOrderRealTime,
  removeOrderRealTime
} = orderSlice.actions;

export default orderSlice.reducer;