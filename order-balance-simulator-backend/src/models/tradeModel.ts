// models/tradeModel.ts - STVORI NOVI FAJL
import mongoose, { Schema, Document } from 'mongoose';

export interface ITrade extends Document {
  buyOrderId: string;
  sellOrderId: string;
  pair: string;
  price: number;
  amount: number;
  timestamp: Date;
}

const tradeSchema = new Schema<ITrade>({
  buyOrderId: { type: String, required: true },
  sellOrderId: { type: String, required: true },
  pair: { type: String, required: true, uppercase: true },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now }
});

// Indexi za brže pretrage
tradeSchema.index({ pair: 1, timestamp: -1 });
tradeSchema.index({ buyOrderId: 1 });
tradeSchema.index({ sellOrderId: 1 });

export default mongoose.model<ITrade>('Trade', tradeSchema);