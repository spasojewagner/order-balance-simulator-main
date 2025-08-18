// src/server.ts - ZAMIJENI POSTOJEĆI
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

import orderRoutes from './routes/orderRoutes';
import { tradingService } from './services/tradingServices'; 
dotenv.config();

// ----- 1) INIT -----
const app = express();
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:8080",
  credentials: true,
  methods: ["GET","POST","PUT","OPTIONS","DELETE","PATCH" ]
}));

app.use(express.json());

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:8080' ,
  credentials: true,
  }
});

// 🔥 TRADING SERVICE SETUP
tradingService.setSocketIO(io);

// ----- 2) DATABASE -----
(async () => {
  await connectDB();
})();

//-----Routes------

app.use('/api/orders', orderRoutes);

// ----- 3) COINGECKO PROXY + CACHE + RATE LIMIT -----
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

// ----- 4) ROUTES -----
const wrap = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

app.get('/api/coins/markets', wrap(async (req, res) => {
  const data = await proxyGet('/coins/markets', {
    vs_currency: req.query.vs_currency || 'usd',
    order: req.query.order || 'market_cap_desc',
    per_page: req.query.per_page || 20,
    page: req.query.page || 1,
    sparkline: req.query.sparkline ?? true,
    price_change_percentage: req.query.price_change_percentage || '7d',
  });
  res.json(data);
}));

app.get('/api/coins/:coinId/market_chart', wrap(async (req, res) => {
  const data = await proxyGet(
    `/coins/${req.params.coinId}/market_chart`,
    {
      vs_currency: req.query.vs_currency || 'usd',
      days: req.query.days,
      interval: req.query.interval,
    }
  );
  res.json(data);
}));

app.get('/api/coins/:coinId', wrap(async (req, res) => {
  const data = await proxyGet(`/coins/${req.params.coinId}`, {});
  res.json(data);
}));

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌', err);
  res.status(err.status || 500).json({ error: err.message });
});

// ----- 5) SOCKET.IO + BINANCE STREAM -----
const coinToBinance: Record<string,string> = {
  bitcoin: 'btcusdt', ethereum: 'ethusdt', /* ... */
};

const activeSubs = new Set<string>();
const latestPrices: Record<string,number> = {};
const socketsBinance: Record<string, WebSocket> = {};

function connectBinance(symbol: string) {
  if (socketsBinance[symbol]?.readyState === WebSocket.OPEN) return;

  const url = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
  const ws = new WebSocket(url);

  ws.on('open', () => socketsBinance[symbol] = ws);
  ws.on('message', msg => {
    const { p } = JSON.parse(msg.toString());
    const price = parseFloat(p);
    const coinId = Object.entries(coinToBinance)
      .find(([, sym]) => sym === symbol)?.[0];
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

io.on('connection', (socket: Socket) => {
  socket.on('subscribe', (coinId: string) => {
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
  socket.on('unsubscribe', (coinId: string) => activeSubs.delete(coinId));
});

// Fallback na CoinGecko
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

// ----- 6) START SERVER -----
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // 🔥 INICIJALIZUJ TRADING SERVICE
  try {
    await tradingService.initialize();
    console.log('✅ Trading service initialized');
    console.log('📊 Active pairs:', tradingService.getActivePairs());
  } catch (error) {
    console.error('❌ Trading service failed:', error);
  }
});