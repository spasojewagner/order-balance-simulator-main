// 1. PRVO - Ažuriraj Trade model
// order-balance-simulator-backend/src/models/tradeModel.ts

import { Schema, model, Document } from 'mongoose';

export interface ITrade extends Document {
  tradeId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerAddress: string;
  sellerAddress: string;
  pair: string;
  price: number;
  amount: number;
  total: number;
  timestamp: Date;
  
  // BLOCKCHAIN FIELDS - NOVO
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  onChainStatus: 'pending' | 'confirmed' | 'failed' | 'not_executed';
  blockchainError?: string;
}

const TradeSchema = new Schema<ITrade>({
  tradeId: { type: String, required: true, unique: true },
  buyOrderId: { type: String, required: true },
  sellOrderId: { type: String, required: true },
  buyerAddress: { type: String, required: true },
  sellerAddress: { type: String, required: true },
  pair: { type: String, required: true },
  price: { type: Number, required: true },
  amount: { type: Number, required: true },
  total: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  
  // Blockchain fields
  txHash: { type: String, sparse: true },
  blockNumber: { type: Number },
  gasUsed: { type: String },
  onChainStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'failed', 'not_executed'],
    default: 'not_executed'
  },
  blockchainError: { type: String }
}, {
  timestamps: true
});

export default model<ITrade>('Trade', TradeSchema);