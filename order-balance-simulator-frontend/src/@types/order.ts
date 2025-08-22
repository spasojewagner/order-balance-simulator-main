// === ENUMS ===

export enum OrderType {
    BuyLimit = 0,
    SellLimit = 1,
    BuyMarket = 2,
    SellMarket = 3,
    Buy = 4,
    Sell = 5,
}

export enum OrderStatus {
    Pending = 0,
    Filled = 1,
    Canceled = 2,
}

// === LABELS ===

export const orderTypeLabel = {
    [OrderType.BuyLimit]: 'Limit Buy',
    [OrderType.SellLimit]: 'Limit Sell', 
    [OrderType.BuyMarket]: 'Market Buy',
    [OrderType.SellMarket]: 'Market Sell',
    [OrderType.Buy]: 'Buy',
    [OrderType.Sell]: 'Sell'
};

export const orderStatusLabel = {
    [OrderStatus.Pending]: 'Pending',
    [OrderStatus.Filled]: 'Filled',
    [OrderStatus.Canceled]: 'Cancelled'
};

// === BACKEND INTERFACES (API Response) ===

// Backend order interface (što dobijate sa API-ja)
export interface IOrder {
    _id: string;
    no: number;
    pair: string;
    type: 'Limit Sell' | 'Limit Buy';
    price: number;
    amount: number;
    total: number;
    orderTime: string;
    filledTime?: string;
    status: 'Filled' | 'Cancelled' | 'Pending';
    createdAt: string;
    updatedAt: string;
    quantity?: number
}

// === FRONTEND INTERFACES ===

// Frontend order interface za order book
export interface IOrderBookItem {
    symbol?: string;
    price: number;
    quantity: number;
    total: number;
    type?: OrderType;
}

export interface IOrderBook {
    sell: IOrderBookItem[];
    buy: IOrderBookItem[];
}

// Frontend order history interface
export interface IOrderHistory {
    _id: string;
    order: {
        symbol: string;
        type: OrderType; // Koristim enum umesto number
        price: number;
        quantity: number;
        total: number;
    };
    status: OrderStatus; // Koristim enum umesto number
    created: Date;
    completed?: Date;
}

// Za dodavanje novih order-a u frontend
export interface IOrderAdd {
    type: OrderType;
    symbol: string;
    price: number;
    quantity: number;
    total: number;
    status: OrderStatus;
}

// === API REQUEST/RESPONSE INTERFACES ===

export interface CreateOrderRequest {
    no: number;
    pair: string;
    type: 'Limit Sell' | 'Limit Buy';
    price: number;
    amount: number;
    orderTime?: string;
    status?: 'Filled' | 'Cancelled' | 'Pending';
    symbol?: number
    quantity?: number
}

export interface OrderFilters {
    pair?: string;
    status?: 'Filled' | 'Cancelled' | 'Pending';
    type?: 'Limit Sell' | 'Limit Buy';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface OrdersResponse {
    success: boolean;
    data: {
        orders: IOrder[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalOrders: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
            limit: number;
        };
    };
}

export interface SingleOrderResponse {
    success: boolean;
    data: IOrder;
    message?: string;
}

export interface OrderStatsResponse {
    success: boolean;
    data: {
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
    };
}

// === HELPER FUNCTIONS ===

// Konvertovanje backend string tipa u frontend enum
export const convertBackendTypeToEnum = (backendType: 'Limit Sell' | 'Limit Buy'): OrderType => {
    switch (backendType) {
        case 'Limit Sell':
            return OrderType.SellLimit;
        case 'Limit Buy':
            return OrderType.BuyLimit;
        default:
            return OrderType.BuyLimit;
    }
};

// Konvertovanje backend string statusa u frontend enum  
export const convertBackendStatusToEnum = (backendStatus: 'Filled' | 'Cancelled' | 'Pending'): OrderStatus => {
    switch (backendStatus) {
        case 'Filled':
            return OrderStatus.Filled;
        case 'Cancelled':
            return OrderStatus.Canceled;
        case 'Pending':
            return OrderStatus.Pending;
        default:
            return OrderStatus.Pending;
    }
};

// Konvertovanje frontend enum tipa u backend string
export const convertEnumTypeToBackend = (enumType: OrderType): 'Limit Sell' | 'Limit Buy' => {
    switch (enumType) {
        case OrderType.SellLimit:
            return 'Limit Sell';
        case OrderType.BuyLimit:
            return 'Limit Buy';
        default:
            return 'Limit Buy';
    }
};

// Konvertovanje frontend enum statusa u backend string
export const convertEnumStatusToBackend = (enumStatus: OrderStatus): 'Filled' | 'Cancelled' | 'Pending' => {
    switch (enumStatus) {
        case OrderStatus.Filled:
            return 'Filled';
        case OrderStatus.Canceled:
            return 'Cancelled';
        case OrderStatus.Pending:
            return 'Pending';
        default:
            return 'Pending';
    }
};