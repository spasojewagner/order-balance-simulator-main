import { Request, Response, NextFunction } from 'express';
import Order, { OrderType, OrderStatus, IOrder, OrderService } from '../models/orderModel';
import { validationResult } from 'express-validator';

export class OrderController {
  
  // GET /api/orders - Dobijanje svih order-a sa opcionalnim filterima
static async getAllOrders(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('🔍 Raw req.query:', req.query);
    
    const { 
      pair, 
      status, 
      type, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      sortBy = 'orderTime',
      sortOrder = 'desc'
    } = req.query;

    // PROBLEM: Možda status ili type filteruju podatke koji ne postoje
    console.log('🔍 Individual params:', { pair, status, type, startDate, endDate });

    // Kreiranje filtera - DODAJTE PROVERU
    const filters: any = {};
    
    // OPREZ: Proverite da li ove vrednosti postoje u bazi
    if (pair && pair !== 'undefined') {
      filters.pair = (pair as string).toUpperCase();
      console.log('🔍 Added pair filter:', filters.pair);
    }
    
    if (status && status !== 'undefined' && status !== '') {
      filters.status = status as OrderStatus;
      console.log('🔍 Added status filter:', filters.status);
    }
    
    if (type && type !== 'undefined' && type !== '') {
      filters.type = type as OrderType;
      console.log('🔍 Added type filter:', filters.type);
    }

    // Datum filteri
    if (startDate || endDate) {
      filters.orderTime = {};
      if (startDate) filters.orderTime.$gte = new Date(startDate as string);
      if (endDate) filters.orderTime.$lte = new Date(endDate as string);
      console.log('🔍 Added date filter:', filters.orderTime);
    }

    console.log('🔍 Final filters object:', JSON.stringify(filters, null, 2));

    // TEST: Probajte prvo bez filtera
    const testCount = await Order.countDocuments();
    const testNoFilters = await Order.find({}).limit(3);
    console.log('🔍 Total orders in DB:', testCount);
    console.log('🔍 Sample without filters:', testNoFilters.length);

    // Zatim sa filterima
    const countWithFilters = await Order.countDocuments(filters);
    console.log('🔍 Count with filters:', countWithFilters);

    // Paginacija
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sortiranje
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    console.log('🔍 Pagination - Skip:', skip, 'Limit:', limitNum);
    console.log('🔍 Sort:', sort);

    // Pronalaženje order-a
    const [orders, total] = await Promise.all([
      Order.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filters)
    ]);

    console.log('🔍 Final results - Orders found:', orders.length);
    console.log('🔍 Total matching filters:', total);
    
    if (orders.length > 0) {
      console.log('🔍 First order:', JSON.stringify(orders[0], null, 2));
    }

    // Kalkulisanje paginacije
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalOrders: total,
          hasNextPage,
          hasPrevPage,
          limit: limitNum
        }
      }
    };

    console.log('🔍 Sending response with orders count:', orders.length);
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ getAllOrders error:', error);
    next(error);
  }
}
  // GET /api/orders/:id - Dobijanje order-a po ID-u
  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/number/:no - Dobijanje order-a po broju
  static async getOrderByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { no } = req.params;
      
      const order = await Order.findOne({ no: parseInt(no) });
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/orders - Kreiranje novog order-a
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { no, pair, type, price, amount, orderTime, status } = req.body;

      const newOrder = await OrderService.createOrder({
        no,
        pair,
        type,
        price,
        amount,
        orderTime: orderTime ? new Date(orderTime) : undefined,
        status
      });

      res.status(201).json({
        success: true,
        data: newOrder,
        message: 'Order created successfully'
      });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Order number already exists'
        });
      }
      next(error);
    }
  }

  // PUT /api/orders/:id - Ažuriranje order-a
  static async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Ako se menja price ili amount, recalculate total
      if (updateData.price || updateData.amount) {
        const order = await Order.findById(id);
        if (order) {
          const price = updateData.price || order.price;
          const amount = updateData.amount || order.amount;
          updateData.total = price * amount;
        }
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/orders/:id/cancel - Otkazivanje order-a
  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.status === OrderStatus.FILLED) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel filled order'
        });
      }

      await order.cancel();

      res.status(200).json({
        success: true,
        data: order,
        message: 'Order cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/orders/:id/fill - Označavanje order-a kao popunjen
  static async fillOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { filledTime } = req.body;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.status === OrderStatus.FILLED) {
        return res.status(400).json({
          success: false,
          message: 'Order is already filled'
        });
      }

      await order.fill(filledTime ? new Date(filledTime) : undefined);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Order filled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/orders/:id - Brisanje order-a
  static async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const deletedOrder = await Order.findByIdAndDelete(id);
      
      if (!deletedOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/stats/volume/:pair - Statistike po paru
  static async getVolumeStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { pair } = req.params;
      
      const stats = await OrderService.getTotalVolumeByPair(pair);

      res.status(200).json({
        success: true,
        data: {
          pair: pair.toUpperCase(),
          ...stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/stats/summary - Opšte statistike
  static async getOrdersSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const [totalOrders, filledOrders, cancelledOrders, pairStats] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ status: OrderStatus.FILLED }),
        Order.countDocuments({ status: OrderStatus.CANCELLED }),
        Order.aggregate([
          {
            $group: {
              _id: '$pair',
              totalOrders: { $sum: 1 },
              totalVolume: { $sum: '$total' },
              avgPrice: { $avg: '$price' }
            }
          },
          { $sort: { totalVolume: -1 } },
          { $limit: 10 }
        ])
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalOrders,
          filledOrders,
          cancelledOrders,
          pendingOrders: totalOrders - filledOrders - cancelledOrders,
          topPairs: pairStats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/orders/bulk - Bulk kreiranje order-a
  static async createBulkOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { orders } = req.body;

      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Orders array is required'
        });
      }

      const createdOrders = [];
      const errors = [];

      for (let i = 0; i < orders.length; i++) {
        try {
          const orderData = orders[i];
          const newOrder = await OrderService.createOrder(orderData);
          createdOrders.push(newOrder);
        } catch (error: any) {
          errors.push({
            index: i,
            error: error.message,
            data: orders[i]
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          created: createdOrders,
          errors,
          summary: {
            totalRequested: orders.length,
            successful: createdOrders.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}