import axios from 'axios';
import {
  IOrder,
  OrdersResponse,
  SingleOrderResponse,
  OrderStatsResponse,
  CreateOrderRequest,
  OrderFilters
} from "../@types/order";


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
console.log('🌐 API Base URL:', API_BASE_URL);

// Kreiraj axios instancu
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10s timeout
});

// Request interceptor za debugging
api.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url, config.data);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor za error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Dodatno: provjeri da li je CORS greška
    if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
      console.error('🚨 Možda CORS problem ili server nije pokrenut!');
    }
    
    return Promise.reject(error);
  }
);

export class OrderAPI {
  // Dobijanje svih order-a sa filterima
  static async getAllOrders(filters: OrderFilters = {}): Promise<OrdersResponse> {
    try {
      console.log('📡 Fetching orders with filters:', filters);
      const response = await api.get('/api/orders', { params: filters });
      console.log('✅ Orders fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch orders:', error);
      throw error;
    }
  }

  // Dobijanje order-a po ID-u
  static async getOrderById(id: string): Promise<SingleOrderResponse> {
    const response = await api.get(`/api/orders/${id}`);
    return response.data;
  }

  // Dobijanje order-a po broju
  static async getOrderByNumber(no: number): Promise<SingleOrderResponse> {
    const response = await api.get(`/api/orders/number/${no}`);
    return response.data;
  }

  // Kreiranje novog order-a
  static async createOrder(orderData: CreateOrderRequest): Promise<SingleOrderResponse> {
    try {
      console.log('🏗️ Creating order:', orderData);
      const response = await api.post('/api/orders', orderData);
      console.log('✅ Order created:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to create order:', error);
      throw error;
    }
  }

  // Bulk kreiranje order-a
  static async createBulkOrders(orders: CreateOrderRequest[]): Promise<any> {
    const response = await api.post('/api/orders/bulk', { orders });
    return response.data;
  }

  // Ažuriranje order-a
  static async updateOrder(id: string, updateData: Partial<CreateOrderRequest>): Promise<SingleOrderResponse> {
    const response = await api.put(`/api/orders/${id}`, updateData);
    return response.data;
  }

  // 🚨 ISPRAVKA: Otkazivanje order-a - koristi PATCH umesto DELETE
  static async cancelOrder(id: string): Promise<SingleOrderResponse> {
    try {
      console.log('🚫 Canceling order:', id);
      const response = await api.patch(`/api/orders/${id}/cancel`);
      console.log('✅ Order canceled:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      throw error;
    }
  }

  // Označavanje order-a kao popunjen
  static async fillOrder(id: string, filledTime?: string): Promise<SingleOrderResponse> {
    const response = await api.patch(`/api/orders/${id}/fill`, { filledTime });
    return response.data;
  }

  // Brisanje order-a
  static async deleteOrder(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/api/orders/${id}`);
    return response.data;
  }

  // Statistike po paru
  static async getVolumeStats(pair: string): Promise<any> {
    const response = await api.get(`/api/orders/stats/volume/${pair}`);
    return response.data;
  }

  // Opšte statistike
  static async getOrdersSummary(): Promise<OrderStatsResponse> {
    const response = await api.get('/api/orders/stats/summary');
    return response.data;
  }

  // === NOVE TRADING ENGINE METODE ===
  
  // Dobijanje order book-a
  static async getOrderBook(pair: string): Promise<any> {
    try {
      console.log('📊 Fetching order book for:', pair);
      const response = await api.get(`/api/orders/orderbook/${pair}`);
      console.log('✅ Order book fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch order book:', error);
      throw error;
    }
  }

  // Dobijanje recent trades
  static async getRecentTrades(pair: string, limit: number = 50): Promise<any> {
    try {
      console.log('📈 Fetching recent trades for:', pair);
      const response = await api.get(`/api/orders/trades/${pair}`, {
        params: { limit }
      });
      console.log('✅ Recent trades fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch recent trades:', error);
      throw error;
    }
  }

  // Dobijanje market data
  static async getMarketData(pair: string): Promise<any> {
    try {
      console.log('💹 Fetching market data for:', pair);
      const response = await api.get(`/api/orders/market/${pair}`);
      console.log('✅ Market data fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch market data:', error);
      throw error;
    }
  }

  // Dobijanje active pairs
  static async getActivePairs(): Promise<any> {
    try {
      console.log('🔄 Fetching active trading pairs');
      const response = await api.get('/api/orders/active-pairs');
      console.log('✅ Active pairs fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch active pairs:', error);
      throw error;
    }
  }
}

export default OrderAPI;