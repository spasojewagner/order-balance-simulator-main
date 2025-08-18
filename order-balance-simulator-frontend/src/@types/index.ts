// @types/symbol.ts or types/symbol.ts
// This should be in a separate file that you import

export interface ISymbol {
    id: string;                // CoinGecko ID (e.g., 'bitcoin', 'ethereum')
    symbol: string;            // Trading symbol (e.g., 'BTC', 'ETH')
    name?: string;             // Full name (e.g., 'Bitcoin', 'Ethereum')
    current_price?: number;    // Current price in USD
    image?: string;            // Logo URL
    market_cap?: number;       // Market capitalization
    market_cap_rank?: number;  // Market cap ranking
    price_change_24h?: number; // 24h price change
    price_change_percentage_24h?: number; // 24h price change percentage
    total_volume?: number;     // 24h trading volume
    high_24h?: number;         // 24h high
    low_24h?: number;          // 24h low
    circulating_supply?: number; // Circulating supply
    total_supply?: number;     // Total supply
    max_supply?: number;       // Maximum supply
    ath?: number;              // All-time high
    ath_change_percentage?: number; // ATH change percentage
    ath_date?: string;         // ATH date
    atl?: number;              // All-time low
    atl_change_percentage?: number; // ATL change percentage
    atl_date?: string;         // ATL date
    last_updated?: string;     // Last update timestamp
}