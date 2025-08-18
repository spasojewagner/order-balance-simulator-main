import { ISymbol } from "../@types";

const symbols: ISymbol[] = [
    {
        coinA: "BTC",
        coinB: "USDT",
        symbol: "btcusdt",
    },
    {
        coinA: "ETH",
        coinB: "BTC",
        symbol: "ethbtc",
    },
    {
        coinA: "LTC",
        coinB: "USDT",
        symbol: "ltcusdt",
    },
    {
        coinA: "XRP",
        coinB: "USDT",
        symbol: "xrpusdt",
    },
];

const colorVariants = {
    blue: "bg-blue-600 hover:bg-blue-500",
    red: "bg-red-600 hover:bg-red-500",
    yellow: "bg-yellow-600 hover:bg-yellow-500",
    green: "bg-green-600 hover:bg-green-500",
};

export { symbols, colorVariants };
