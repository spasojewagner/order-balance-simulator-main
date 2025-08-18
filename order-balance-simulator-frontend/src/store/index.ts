import { configureStore, combineReducers, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import orderReducer from './slices/orderSlice';
import { symbols } from '../utils/constant';
import { ISymbol } from '../@types';

// Wallet Integration State
interface WalletState {
  walletAddress: string;
  walletConnected: boolean;
  networkId: number | null;
  networkName: string;
  isLoading: boolean;
}

// Main App State (extended with wallet)
interface AppState {
  balance1: number;
  balance2: number;
  currentSymbolPrice: number;
  currentSymbol: ISymbol;
  // Wallet related state
  walletAddress: string;
  walletConnected: boolean;
  networkId: number | null;
  networkName: string;
  walletLoading: boolean;
  // Trading preferences
  tradingMode: 'off-chain' | 'on-chain' | 'hybrid';
  autoRefreshBalances: boolean;
}

const initialAppState: AppState = {
  balance1: 0,
  balance2: 0,
  currentSymbolPrice: 0,
  currentSymbol: symbols[0],
  // Wallet initial state
  walletAddress: '',
  walletConnected: false,
  networkId: null,
  networkName: '',
  walletLoading: false,
  // Trading preferences
  tradingMode: 'hybrid',
  autoRefreshBalances: true,
};

const appSlice = createSlice({
  name: "app",
  initialState: initialAppState,
  reducers: {
    // Existing balance and symbol actions
    setBalance1(state, action: PayloadAction<number>) {
      state.balance1 = action.payload;
    },
    setBalance2(state, action: PayloadAction<number>) {
      state.balance2 = action.payload;
    },
    setCurrentSymbolPrice(state, action: PayloadAction<number>) {
      state.currentSymbolPrice = action.payload;
    },
    setCurrentSymbol(state, action: PayloadAction<string>) {
      state.currentSymbol = symbols.find((symbol: ISymbol) => symbol.symbol === action.payload) ?? symbols[0];
    },
    
    // New Wallet Integration Actions
    setWalletAddress(state, action: PayloadAction<string>) {
      state.walletAddress = action.payload;
    },
    setWalletConnected(state, action: PayloadAction<boolean>) {
      state.walletConnected = action.payload;
    },
    setNetworkId(state, action: PayloadAction<number | null>) {
      state.networkId = action.payload;
    },
    setNetworkName(state, action: PayloadAction<string>) {
      state.networkName = action.payload;
    },
    setWalletLoading(state, action: PayloadAction<boolean>) {
      state.walletLoading = action.payload;
    },
    
    // Trading Mode Actions
    setTradingMode(state, action: PayloadAction<'off-chain' | 'on-chain' | 'hybrid'>) {
      state.tradingMode = action.payload;
    },
    setAutoRefreshBalances(state, action: PayloadAction<boolean>) {
      state.autoRefreshBalances = action.payload;
    },
    
    // Composite actions for better UX
    connectWallet(state, action: PayloadAction<{ address: string; networkId: number; networkName: string }>) {
      state.walletAddress = action.payload.address;
      state.walletConnected = true;
      state.networkId = action.payload.networkId;
      state.networkName = action.payload.networkName;
      state.walletLoading = false;
    },
    
    disconnectWallet(state) {
      state.walletAddress = '';
      state.walletConnected = false;
      state.networkId = null;
      state.networkName = '';
      state.walletLoading = false;
      // Optionally reset balances when disconnecting
      // state.balance1 = 0;
      // state.balance2 = 0;
    },
    
    updateBalances(state, action: PayloadAction<{ balance1: number; balance2: number }>) {
      state.balance1 = action.payload.balance1;
      state.balance2 = action.payload.balance2;
    },
    
    // Network change handler
    updateNetwork(state, action: PayloadAction<{ networkId: number; networkName: string }>) {
      state.networkId = action.payload.networkId;
      state.networkName = action.payload.networkName;
      // Reset balances when network changes as they might be different
      state.balance1 = 0;
      state.balance2 = 0;
    },
  },
});

// Create the root reducer
const rootReducer = combineReducers({
  orders: orderReducer,
  app: appSlice.reducer,
});

// Configure the store with enhanced middleware
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these paths in serialization checks (useful for complex objects)
        ignoredPaths: [
          'orders.orders',
          'orders.rawOrders', 
          'orders.currentOrder',
          'app.currentSymbol', // If symbol objects contain functions
        ],
        ignoredActions: [
          // Add any actions that contain non-serializable data
          'app/connectWallet',
          'app/updateNetwork'
        ],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Enhanced type definitions
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Enhanced typed hooks with better type inference
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export all actions from app slice
export const { 
  // Balance and symbol actions
  setBalance1, 
  setBalance2, 
  setCurrentSymbolPrice, 
  setCurrentSymbol,
  
  // Wallet actions
  setWalletAddress,
  setWalletConnected,
  setNetworkId,
  setNetworkName,
  setWalletLoading,
  
  // Trading mode actions
  setTradingMode,
  setAutoRefreshBalances,
  
  // Composite actions
  connectWallet,
  disconnectWallet,
  updateBalances,
  updateNetwork,
} = appSlice.actions;

// Selector helpers for better component usage
export const selectWalletState = (state: RootState) => ({
  address: state.app.walletAddress,
  connected: state.app.walletConnected,
  networkId: state.app.networkId,
  networkName: state.app.networkName,
  loading: state.app.walletLoading,
});

export const selectBalances = (state: RootState) => ({
  balance1: state.app.balance1,
  balance2: state.app.balance2,
  currentSymbol: state.app.currentSymbol,
  currentPrice: state.app.currentSymbolPrice,
});

export const selectTradingPreferences = (state: RootState) => ({
  mode: state.app.tradingMode,
  autoRefresh: state.app.autoRefreshBalances,
});

// Action creators for complex operations (thunks could go here later)
export const createWalletConnectionAction = (address: string, networkId: number, networkName: string) => 
  connectWallet({ address, networkId, networkName });

export const createNetworkUpdateAction = (networkId: number, networkName: string) =>
  updateNetwork({ networkId, networkName });

export const createBalanceUpdateAction = (balance1: number, balance2: number) =>
  updateBalances({ balance1, balance2 });

// Default export
export default store;