// models/orderModel.ts - FIXED VERSION ZA MARKET ORDERS
import mongoose, { Schema, Document } from 'mongoose';

export enum OrderType {
  LIMIT_BUY = 'Limit Buy',
  LIMIT_SELL = 'Limit Sell', 
  MARKET_BUY = 'Market Buy',
  MARKET_SELL = 'Market Sell'
}

export enum OrderStatus {
  PENDING = 'Pending',
  FILLED = 'Filled',
  CANCELLED = 'Cancelled'
}

export interface IOrder extends Document {
  _id: string;
  no: number;
  pair: string;
  type: OrderType;
  price?: number; // 🔧 FIXED: Optional za market orders
  executedPrice?: number; // Cena po kojoj je izvršen
  amount: number;
  total: number;
  orderTime: Date;
  filledTime?: Date;
  status: OrderStatus;
  walletAddress?: string;
  
  cancel(): Promise<IOrder>;
  fill(filledTime?: Date): Promise<IOrder>;
}

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

const orderSchema = new Schema<IOrder>({
  no: {
    type: Number,
    required: false,
    unique: true,
    min: 1
  },
  pair: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 12
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(OrderType)
  },
  // 🔧 KRITIČNA ISPRAVKA: Price handling za market vs limit orders
  price: {
    type: Number,
    required: false, // Nije obavezno za market orders
    validate: {
      validator: function (v: number | undefined) {
        console.log(`🔍 Validating price: ${v} for order type: ${this.type}`);
        
        // Ako je Limit order, cena MORA biti pozitivna
        if (this.type && this.type.toString().includes('Limit')) {
          if (v === undefined || v === null) {
            console.log('❌ Limit order missing price');
            return false;
          }
          if (isNaN(v) || v <= 0) {
            console.log('❌ Invalid price for limit order:', v);
            return false;
          }
          return true;
        }
        
        // Ako je Market order, price može biti undefined ili null
        if (this.type && this.type.toString().includes('Market')) {
          if (v === undefined || v === null) {
            console.log('✅ Market order with no price - OK');
            return true;
          }
          // Ako je definisana, mora biti validna
          if (isNaN(v) || v < 0) {
            console.log('❌ Invalid price for market order:', v);
            return false;
          }
          console.log('✅ Market order with valid price - OK');
          return true;
        }
        
        return true;
      },
      message: function(props: any) {
        if (props.value && isNaN(props.value)) {
          return 'Price cannot be NaN';
        }
        return 'Invalid price for order type';
      }
    }
  },
  // Cena po kojoj je order stvarno izvršen (popunjava backend)
  executedPrice: {
    type: Number,
    required: false,
    validate: {
      validator: function (v: number) {
        return v === undefined || v === null || (!isNaN(v) && v > 0);
      },
      message: 'Executed price must be a positive number'
    }
  },
  amount: {
    type: Number,
    required: true,
    min: 0.000001,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && v > 0;
      },
      message: 'Amount must be a positive number'
    }
  },
  total: {
    type: Number,
    required: false,
    min: 0,
    validate: {
      validator: function(v: number) {
        return v === undefined || v === null || (!isNaN(v) && v >= 0);
      },
      message: 'Total cannot be NaN'
    }
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
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING
  },
  walletAddress: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  versionKey: false
});

// 🔧 FIXED: Pre-save middleware sa boljim handling-om
orderSchema.pre('save', async function(next) {
  const order = this as IOrder;
  
  try {
    console.log('💾 Pre-save order data:', {
      type: order.type,
      price: order.price,
      amount: order.amount,
      pair: order.pair
    });

    // Auto-generate order number
    if (order.isNew && !order.no) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'orderNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      order.no = counter.seq;
      console.log('✅ Auto-generated order number:', order.no);
    }
    
    // 🔧 KRITIČNA ISPRAVKA: Handle total calculation
    if (!order.total || order.isModified('price') || order.isModified('amount')) {
      // Za market orders, total se računa nakon izvršavanja
      if (order.type && order.type.toString().includes('Market')) {
        if (order.executedPrice && !isNaN(order.executedPrice)) {
          order.total = Number((order.executedPrice * order.amount).toFixed(8));
          console.log('✅ Market order total calculated with executedPrice:', order.total);
        } else {
          // Ostavi total = 0 dok se ne izvrši order
          order.total = 0;
          console.log('✅ Market order total set to 0 (pending execution)');
        }
      } else {
        // Za limit orders, koristi zadatu cenu
        if (order.price && !isNaN(order.price)) {
          order.total = Number((order.price * order.amount).toFixed(8));
          console.log('✅ Limit order total calculated:', order.total);
        }
      }
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

// 🔧 FIXED: createOrder method
orderSchema.statics.createOrder = async function(orderData: Partial<IOrder>): Promise<IOrder> {
  console.log('🏗️ OrderService.createOrder called with:', orderData);
  
  // Sanitize price field
  let price: number | undefined = undefined;
  
  if (orderData.price !== undefined && orderData.price !== null) {
    const numPrice = Number(orderData.price);
    if (!isNaN(numPrice)) {
      price = numPrice;
    } else {
      console.warn('⚠️ Invalid price provided, setting to undefined:', orderData.price);
    }
  }
  
  const order = new this({
    pair: orderData.pair?.toUpperCase(),
    type: orderData.type,
    price: price, // undefined za market orders ili validna cena za limit
    amount: Number(orderData.amount),
    orderTime: orderData.orderTime || new Date(),
    status: orderData.status || OrderStatus.PENDING,
    walletAddress: orderData.walletAddress,
    no: orderData.no
  });
  
  console.log('💾 Creating order with sanitized data:', {
    type: order.type,
    price: order.price,
    amount: order.amount
  });
  
  const savedOrder = await order.save();
  console.log('✅ Order created with ID:', savedOrder._id, 'Number:', savedOrder.no);
  return savedOrder;
};

// Add indexes
orderSchema.index({ pair: 1, status: 1 });
orderSchema.index({ orderTime: -1 });
orderSchema.index({ no: 1 }, { unique: true });

const Order = mongoose.model<IOrder>('Order', orderSchema);

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