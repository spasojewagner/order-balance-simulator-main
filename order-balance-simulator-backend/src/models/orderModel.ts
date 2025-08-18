// models/orderModel.ts - Fixed version
import mongoose, { Schema, Document } from 'mongoose';

// Enums that match your frontend
export enum OrderType {
  LIMIT_BUY = 'Limit Buy',
  LIMIT_SELL = 'Limit Sell', 
  MARKET_BUY = 'Market Buy',
  MARKET_SELL = 'Market Sell'
}

export enum OrderStatus {
  PENDING = 'Pending',      // ✅ Fixed: was probably 'PENDING' 
  FILLED = 'Filled',        // ✅ Fixed: was probably 'FILLED'
  CANCELLED = 'Cancelled'   // ✅ Fixed: was probably 'CANCELLED'
}

// Interface for the Order document
export interface IOrder extends Document {
  _id: string;
  no: number;               // Order number - will be auto-generated
  pair: string;             // Trading pair (e.g., 'BTCUSDT')
  type: OrderType;          // Order type
  price: number;            // Order price
  amount: number;           // Order amount/quantity
  total: number;            // Total value (price * amount)
  orderTime: Date;          // When order was created
  filledTime?: Date;        // When order was filled (optional)
  status: OrderStatus;      // Current status
  
  // Methods
  cancel(): Promise<IOrder>;
  fill(filledTime?: Date): Promise<IOrder>;
}

// Create auto-incrementing counter for order numbers
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

// Main Order Schema
const orderSchema = new Schema<IOrder>({
  no: {
    type: Number,
    required: false,        // ✅ Fixed: Make it optional, we'll auto-generate
    unique: true,
    min: 1
  },
  pair: {
    type: String,
    required: true,
    uppercase: true,        // Automatically convert to uppercase
    trim: true,
    minlength: 6,
    maxlength: 12
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(OrderType)  // ✅ Use the correct enum values
  },
  price: {
    type: Number,
    required: true,
    min: 0.000001,
    validate: {
      validator: function(v: number) {
        return v > 0;
      },
      message: 'Price must be greater than 0'
    }
  },
  amount: {
    type: Number,
    required: true,
    min: 0.000001,
    validate: {
      validator: function(v: number) {
        return v > 0;
      },
      message: 'Amount must be greater than 0'
    }
  },
  total: {
    type: Number,
    required: false,        // We'll calculate this automatically
    min: 0
  },
  orderTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  filledTime: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(OrderStatus),  // ✅ Use the correct enum values
    default: OrderStatus.PENDING      // ✅ Set default to 'Pending'
  }
}, {
  timestamps: true,         // Adds createdAt and updatedAt
  versionKey: false         // Removes __v field
});

// Pre-save middleware to auto-generate order number and calculate total
orderSchema.pre('save', async function(next) {
  const order = this as IOrder;
  
  try {
    // Auto-generate order number if not provided
    if (order.isNew && !order.no) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'orderNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      order.no = counter.seq;
      console.log('✅ Auto-generated order number:', order.no);
    }
    
    // Calculate total if not provided
    if (!order.total || order.isModified('price') || order.isModified('amount')) {
      order.total = Number((order.price * order.amount).toFixed(8));
      console.log('✅ Calculated total:', order.total);
    }
    
    next();
  } catch (error) {
    console.error('❌ Pre-save error:', error);
    next(error as Error);
  }
});

// Instance methods
orderSchema.methods.cancel = async function(): Promise<IOrder> {
  if (this.status === OrderStatus.FILLED) {
    throw new Error('Cannot cancel a filled order');
  }
  
  this.status = OrderStatus.CANCELLED;
  return await this.save();
};

orderSchema.methods.fill = async function(filledTime?: Date): Promise<IOrder> {
  if (this.status === OrderStatus.CANCELLED) {
    throw new Error('Cannot fill a cancelled order');
  }
  
  this.status = OrderStatus.FILLED;
  this.filledTime = filledTime || new Date();
  return await this.save();
};

// Static methods for OrderService
orderSchema.statics.createOrder = async function(orderData: Partial<IOrder>): Promise<IOrder> {
  console.log('🏗️ OrderService.createOrder called with:', orderData);
  
  const order = new this({
    pair: orderData.pair?.toUpperCase(),
    type: orderData.type,
    price: Number(orderData.price),
    amount: Number(orderData.amount),
    orderTime: orderData.orderTime || new Date(),
    status: orderData.status || OrderStatus.PENDING,
    no: orderData.no  // Optional, will be auto-generated if not provided
  });
  
  const savedOrder = await order.save();
  console.log('✅ Order created with ID:', savedOrder._id, 'Number:', savedOrder.no);
  return savedOrder;
};

// Add index for better performance
orderSchema.index({ pair: 1, status: 1 });
orderSchema.index({ orderTime: -1 });
orderSchema.index({ no: 1 }, { unique: true });

// Create the model
const Order = mongoose.model<IOrder>('Order', orderSchema);

// Export OrderService as part of the model
export const OrderService = {
  createOrder: Order.createOrder.bind(Order),
  
  async getTotalVolumeByPair(pair: string) {
    const result = await Order.aggregate([
      { $match: { pair: pair.toUpperCase() } },
      {
        $group: {
          _id: '$pair',
          totalVolume: { $sum: '$total' },
          avgPrice: { $avg: '$price' },
          orderCount: { $sum: 1 }
        }
      }
    ]);
    
    return result[0] || { totalVolume: 0, avgPrice: 0, orderCount: 0 };
  }
};

export default Order;