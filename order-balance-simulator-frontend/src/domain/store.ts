import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { symbols } from "../utils/constant";
import { IOrderHistory } from "../@types/order";
import { ISymbol } from "../@types";

export interface IStoreState {
    balance1: number;
    balance2: number;
    currentSymbolPrice: number;
    orders: IOrderHistory[];
    currentSymbol: ISymbol;
}

const initialState: IStoreState = {
    balance1: 0,
    balance2: 0,
    currentSymbolPrice: 0,
    orders: [],
    currentSymbol: symbols[0],
};

const orderSlice = createSlice({
    name: "order",
    initialState,
    reducers: {
        setBalance1(state, action: PayloadAction<number>) {
            console.log(action.payload);
            state.balance1 = action.payload;
        },
        setBalace2(state, action: PayloadAction<number>) {
            state.balance2 = action.payload;
        },
        setCurrentSymbolPrice(state, action: PayloadAction<number>) {
            state.currentSymbolPrice = action.payload;
        },
        setOrders(state, action: PayloadAction<IOrderHistory[]>) {
            state.orders = action.payload;
        },
        setCurrentSymbol(state, action: PayloadAction<string>) {
            state.currentSymbol = symbols.find((symbol: ISymbol) => symbol.symbol == action.payload) ?? symbols[0];
        },
    },
});

export const { setBalance1, setBalace2, setCurrentSymbolPrice, setOrders, setCurrentSymbol } = orderSlice.actions;

export default configureStore({
    reducer: orderSlice.reducer,
});
