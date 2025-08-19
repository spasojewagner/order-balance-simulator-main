// order-balance-simulator-backend/src/server.ts - COMPLETE VERSION WITH TX HASH STORAGE

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
import blockchainRoutes from './routes/blockchainRoutes';
import { tradingService } from './services/tradingServices'; 
import { blockchainService } from './services/blockchainServices';

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

    // Listen for trade events from matching engine
    tradingService.on('tradeOnChainConfirmed', (data) => {
      console.log(`📡 Trade confirmed on-chain: ${data.tradeId}`);
      
      // Notify frontend via WebSocket
      io.emit('trade_blockchain_confirmed', {
        tradeId: data.tradeId,
        txHash: data.txHash,
        blockNumber: data.blockNumber,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for blockchain failure events
    tradingService.on('tradeOnChainFailed', (data) => {
      console.log(`❌ Trade failed on-chain: ${data.tradeId}`);
      
      io.emit('trade_blockchain_failed', {
        tradeId: data.tradeId,
        error: data.error,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor pending transactions every 30 seconds
    setInterval(async () => {
      try {
        const Trade = require('./models/tradeModel').default;
        const pendingTrades = await Trade.find({ 
          onChainStatus: 'pending',
          txHash: { $exists: true }
        });
        
        for (const trade of pendingTrades) {
          const result = await blockchainService.monitorTransaction(trade.txHash);
          
          if (result.success) {
            trade.onChainStatus = 'confirmed';
            trade.blockNumber = result.blockNumber;
            trade.gasUsed = result.gasUsed;
            await trade.save();
            
            console.log(`✅ Trade ${trade.tradeId} confirmed: ${trade.txHash}`);
            
            io.emit('trade_blockchain_confirmed', {
              tradeId: trade.tradeId,
              txHash: trade.txHash,
              blockNumber: result.blockNumber,
              gasUsed: result.gasUsed
            });
          }
        }
      } catch (error) {
        console.error('Error monitoring pending trades:', error);
      }
    }, 30000); // Check every 30 seconds

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
})();

// 🔥 TRADING SERVICE SETUP
tradingService.setSocketIO(io);

// ----- 3) ROUTES -----
app.use('/api/orders', orderRoutes);
app.use('/api/blockchain', blockchainRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      blockchain: blockchainService.isReady() ? 'connected' : 'disconnected',
      trading: 'active'
    }
  });
});

// ----- 4) COINGECKO PROXY + CACHE + RATE LIMIT -----
const cache = new NodeCache({ stdTTL: 60 });
let rateLimitedUntil = 0;

async function proxyGet(path: string, query: Record<string, any>) {
  const key = `${path}_${JSON.stringify(query)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  
  if (Date.now() < rateLimitedUntil) {
    throw new Error('Rate limited');
  }
  
  try {
    const resp = await axios.get(`https://api.coingecko.com/api/v3${path}`, { params: query });
    cache.set(key, resp.data);
    return resp.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      rateLimitedUntil = Date.now() + (retryAfter * 1000);
      throw new Error(`Rate limited for ${retryAfter}s`);
    }
    throw error;
  }
}

app.get('/api/proxy/coingecko/*', async (req: Request, res: Response) => {
  try {
    const path = req.path.replace('/api/proxy/coingecko', '');
    const data = await proxyGet(path, req.query as Record<string, any>);
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ 
      error: error.message || 'Proxy error' 
    });
  }
});

// ----- 5) WEBSOCKET HANDLING -----
interface ConnectedClient {
  socketId: string;
  subscribedPairs: Set<string>;
  walletAddress?: string;
}

const connectedClients = new Map<string, ConnectedClient>();

io.on('connection', (socket: Socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);
  
  connectedClients.set(socket.id, {
    socketId: socket.id,
    subscribedPairs: new Set()
  });

  // Price subscription
  socket.on('subscribe', (coinId: string) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.subscribedPairs.add(coinId);
    }
    
    activeSubs.add(coinId);
    socket.join(`price_${coinId}`);
    console.log(`📊 Client ${socket.id} subscribed to ${coinId}`);
    
    // Send current price if available
    if (latestPrices[coinId]) {
      socket.emit(`price_update_${coinId}`, { 
        price: latestPrices[coinId], 
        timestamp: Date.now() 
      });
    }
    
    // Start Binance stream if needed
    const binanceSymbol = coinToBinance[coinId];
    if (binanceSymbol && !socketsBinance[binanceSymbol]) {
      connectBinance(binanceSymbol);
    }
  });

  socket.on('unsubscribe', (coinId: string) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.subscribedPairs.delete(coinId);
    }
    
    socket.leave(`price_${coinId}`);
    console.log(`📊 Client ${socket.id} unsubscribed from ${coinId}`);
  });

  // Order status subscription
  socket.on('subscribe_orders', (walletAddress: string) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.walletAddress = walletAddress;
    }
    
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

// Enhanced trading service event handlers
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
});

// ----- 6) BINANCE WEBSOCKET -----
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

// Fallback to CoinGecko
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
      if (!health.healthy && !health.mockMode) {
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