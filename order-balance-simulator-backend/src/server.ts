// backend/src/server.ts - ENHANCED VERSION SA BLOCKCHAIN INTEGRATION

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import axios from 'axios';
import NodeCache from 'node-cache';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import connectDB from './config/dataBase';
import cookieParser from 'cookie-parser';

// Import services
import orderRoutes from './routes/orderRoutes';
import blockchainRoutes from './routes/blockchainRoutes'; // 🆕 NEW
import { tradingService } from './services/tradingServices'; 
import { blockchainService } from './services/blockchainServices'; // 🆕 NEW

dotenv.config();

// ----- 1) INIT -----
const app = express();
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:8080",
  credentials: true,
  methods: ["GET","POST","PUT","OPTIONS","DELETE","PATCH"]
}));

app.use(express.json());

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: { 
    origin: process.env.CLIENT_URL || 'http://localhost:8080',
    credentials: true,
  }
});

// ----- 2) DATABASE & BLOCKCHAIN SETUP -----
(async () => {
  try {
    // Initialize database
    await connectDB();
    console.log('✅ Database connected');

    // Initialize blockchain service
    await blockchainService.initialize();
    console.log('✅ Blockchain service initialized');

    // Setup blockchain event listeners
    blockchainService.setupEventListeners((event) => {
      console.log('📡 Blockchain event received:', event.type);
      
      // Emit blockchain events to frontend via WebSocket
      io.emit('blockchain_event', event);
      
      // Handle trade execution events
      if (event.type === 'TradeExecuted') {
        io.emit(`trade_executed`, {
          tradeId: event.data.tradeId,
          buyer: event.data.buyer,
          seller: event.data.seller,
          txHash: event.data.txHash,
          blockNumber: event.data.blockNumber,
          timestamp: event.data.timestamp
        });
      }
    });

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
})();

// 🔥 TRADING SERVICE SETUP
tradingService.setSocketIO(io);

// ----- 3) ROUTES -----
app.use('/api/orders', orderRoutes);
app.use('/api/blockchain', blockchainRoutes); // 🆕 NEW BLOCKCHAIN ROUTES

// ----- 4) COINGECKO PROXY + CACHE + RATE LIMIT -----
const cache = new NodeCache({ stdTTL: 60 });
let rateLimitedUntil = 0;

async function proxyGet(path: string, query: Record<string, any>) {
  const key = `${path}_${JSON.stringify(query)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (Date.now() < rateLimitedUntil) {
    const err: any = new Error('Cooldown active');
    err.status = 429;
    throw err;
  }

  try {
    const resp = await axios.get(`https://api.coingecko.com/api/v3${path}`, {
      params: query,
      headers: { 'User-Agent': 'CryptoSocketApp/1.0' },
    });
    cache.set(key, resp.data);
    return resp.data;
  } catch (e: any) {
    const status = e.response?.status || 500;
    if (status === 429) {
      const retry = parseInt(e.response.headers['retry-after'] || '60', 10);
      rateLimitedUntil = Date.now() + retry * 1000;
      console.warn(`Rate limited; retry after ${retry}s`);
    }
    const err: any = new Error(e.message);
    err.status = status;
    throw err;
  }
}

// Enhanced API routes
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

app.get('/api/coins/markets', wrap(async (req, res) => {
  const data = await proxyGet('/coins/markets', {
    vs_currency: req.query.vs_currency || 'usd',
    order: req.query.order || 'market_cap_desc',
    per_page: req.query.per_page || 20,
    page: req.query.page || 1,
    sparkline: req.query.sparkline ?? false,
  });
  res.json(data);
}));

app.get('/api/coins/:id', wrap(async (req, res) => {
  const data = await proxyGet(`/coins/${req.params.id}`, {
    localization: false,
    tickers: false,
    market_data: true,
    community_data: false,
    developer_data: false,
    sparkline: false,
  });
  res.json(data);
}));

// 🆕 ENHANCED HEALTH CHECK WITH BLOCKCHAIN STATUS
app.get('/api/health', wrap(async (req, res) => {
  try {
    const blockchainHealth = await blockchainService.healthCheck();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        blockchain: {
          healthy: blockchainHealth.healthy,
          latency: blockchainHealth.latency,
          blockNumber: blockchainHealth.blockNumber,
          error: blockchainHealth.error
        },
        trading: {
          activePairs: tradingService.getActivePairs().length,
          status: 'running'
        }
      },
      uptime: process.uptime()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}));

// ----- 5) WEBSOCKET ENHANCEMENTS -----

// Store connected clients with their preferences
const connectedClients = new Map<string, {
  socket: Socket;
  subscribedPairs: Set<string>;
  walletAddress?: string;
}>();

io.on('connection', (socket: Socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Initialize client data
  connectedClients.set(socket.id, {
    socket,
    subscribedPairs: new Set(),
  });

  // 🆕 WALLET ASSOCIATION
  socket.on('associate_wallet', (data: { walletAddress: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.walletAddress = data.walletAddress;
      console.log(`💰 Wallet associated: ${socket.id} → ${data.walletAddress}`);
      
      socket.emit('wallet_associated', {
        success: true,
        walletAddress: data.walletAddress
      });
    }
  });

  // 🆕 BLOCKCHAIN SUBSCRIPTION
  socket.on('subscribe_blockchain_events', () => {
    socket.join('blockchain_events');
    console.log(`🔗 Client ${socket.id} subscribed to blockchain events`);
  });

  socket.on('unsubscribe_blockchain_events', () => {
    socket.leave('blockchain_events');
    console.log(`🔗 Client ${socket.id} unsubscribed from blockchain events`);
  });

  // Enhanced price subscription
  socket.on('subscribe', (coinId: string) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.subscribedPairs.add(coinId);
    }
    
    // Original CoinGecko subscription logic
    activeSubs.add(coinId);
    const sym = coinToBinance[coinId];
    if (sym) {
      connectBinance(sym);
      if (latestPrices[coinId]) {
        socket.emit(`price_update_${coinId}`, {
          price: latestPrices[coinId],
          timestamp: Date.now(),
        });
      }
    }
  });

  socket.on('unsubscribe', (coinId: string) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.subscribedPairs.delete(coinId);
    }
    activeSubs.delete(coinId);
  });

  // 🆕 ORDER STATUS SUBSCRIPTION
  socket.on('subscribe_orders', (walletAddress: string) => {
    socket.join(`orders_${walletAddress}`);
    console.log(`📋 Client ${socket.id} subscribed to orders for ${walletAddress}`);
  });

  socket.on('unsubscribe_orders', (walletAddress: string) => {
    socket.leave(`orders_${walletAddress}`);
    console.log(`📋 Client ${socket.id} unsubscribed from orders for ${walletAddress}`);
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    const client = connectedClients.get(socket.id);
    if (client) {
      // Cleanup subscriptions
      for (const coinId of client.subscribedPairs) {
        activeSubs.delete(coinId);
      }
    }
    
    connectedClients.delete(socket.id);
  });
});

// 🆕 ENHANCED TRADING SERVICE EVENT HANDLERS
tradingService.on('orderMatched', (buyOrder, sellOrder, trades) => {
  console.log(`🎯 Orders matched: ${buyOrder._id} ↔ ${sellOrder._id}`);
  
  // Emit to specific users
  io.to(`orders_${buyOrder.walletAddress}`).emit('order_matched', {
    orderId: buyOrder._id,
    trades
  });
  
  io.to(`orders_${sellOrder.walletAddress}`).emit('order_matched', {
    orderId: sellOrder._id,
    trades
  });

  // 🔗 TRIGGER BLOCKCHAIN EXECUTION (if needed)
  trades.forEach(async (trade) => {
    if (buyOrder.tradingMode === 'on-chain' || buyOrder.tradingMode === 'hybrid') {
      try {
        console.log(`🔗 Executing trade ${trade.tradeId} on blockchain...`);
        
        const result = await blockchainService.executeTradeOnChain({
          tradeId: trade.tradeId,
          buyOrderId: buyOrder._id.toString(),
          sellOrderId: sellOrder._id.toString(),
          buyerAddress: buyOrder.walletAddress,
          sellerAddress: sellOrder.walletAddress,
          tokenA: '0x0000000000000000000000000000000000000000', // TODO: Get from config
          tokenB: '0x0000000000000000000000000000000000000000', // TODO: Get from config
          amountA: trade.amount.toString(),
          amountB: (trade.amount * trade.price).toString(),
          price: trade.price
        });

        if (result.success) {
          console.log(`✅ Trade ${trade.tradeId} executed on blockchain: ${result.txHash}`);
          
          // Update trade with blockchain data
          // TODO: Save to database
          
          // Emit blockchain confirmation
          io.emit('trade_blockchain_confirmed', {
            tradeId: trade.tradeId,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed
          });
        } else {
          console.error(`❌ Blockchain execution failed for trade ${trade.tradeId}: ${result.error}`);
          
          // Emit error
          io.emit('trade_blockchain_failed', {
            tradeId: trade.tradeId,
            error: result.error
          });
        }
      } catch (error: any) {
        console.error(`❌ Error executing trade ${trade.tradeId} on blockchain:`, error);
      }
    }
  });
});

// ----- 6) BINANCE WEBSOCKET (existing code) -----
const activeSubs = new Set<string>();
const latestPrices: Record<string, number> = {};
const socketsBinance: Record<string, WebSocket> = {};

const coinToBinance: Record<string, string> = {
  bitcoin: 'btcusdt',
  ethereum: 'ethusdt',
  cardano: 'adausdt',
  polkadot: 'dotusdt',
  chainlink: 'linkusdt',
  litecoin: 'ltcusdt',
  'binance-coin': 'bnbusdt',
  ripple: 'xrpusdt',
  dogecoin: 'dogeusdt',
  solana: 'solusdt',
};

function connectBinance(symbol: string) {
  if (socketsBinance[symbol]) return;
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
  socketsBinance[symbol] = ws;
  
  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    const price = parseFloat(parsed.c);
    const coinId = Object.keys(coinToBinance).find(k => coinToBinance[k] === symbol) ||
                   Object.keys(coinToBinance)[0];
    if (coinId) {
      latestPrices[coinId] = price;
      io.emit(`price_update_${coinId}`, { price, timestamp: Date.now() });
    }
  });
  
  ws.on('close', () => {
    delete socketsBinance[symbol];
    setTimeout(() => activeSubs.size && connectBinance(symbol), 5000);
  });
}

// Fallback na CoinGecko (existing code)
setInterval(async () => {
  if (!activeSubs.size) return;
  const needs = Array.from(activeSubs).filter(id => {
    const sym = coinToBinance[id];
    return !sym || socketsBinance[sym]?.readyState !== WebSocket.OPEN;
  });
  if (!needs.length) return;
  try {
    const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: needs.join(','), vs_currencies: 'usd' }
    });
    needs.forEach(id => {
      const price = resp.data[id]?.usd;
      if (price) {
        latestPrices[id] = price;
        io.emit(`price_update_${id}`, { price, timestamp: Date.now() });
      }
    });
  } catch (e) {
    console.error('Fallback error:', e);
  }
}, 10_000);

// ----- 7) ERROR HANDLING -----
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ----- 8) START SERVER -----
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  try {
    // Initialize trading service
    await tradingService.initialize();
    console.log('✅ Trading service initialized');
    console.log('📊 Active pairs:', tradingService.getActivePairs());
    
    // Setup periodic blockchain health checks
    setInterval(async () => {
      const health = await blockchainService.healthCheck();
      if (!health.healthy) {
        console.warn('⚠️  Blockchain service unhealthy:', health.error);
      }
    }, 30000); // Check every 30 seconds
    
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Process terminated');
  });
});

export default app;