import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';

const router = express.Router();

// POST /api/orders - Create new order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user._id || (req as any).user.userId;
    const { customerInfo, shippingAddress, items, totalAmount, shippingCost, finalAmount, paymentMethod } = req.body;

    // Generate order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    console.log('Order request:', {
      userId,
      itemsCount: items.length,
      paymentMethod: paymentMethod || 'bank_transfer',
      firstItem: items[0]
    });

    const order = new Order({
      orderId,
      userId,
      customerInfo,
      shippingAddress,
      items: items.map((item: any) => ({
        productId: item.productId || item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        image: item.image
      })),
      totalAmount,
      shippingCost,
      finalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || 'bank_transfer'
    });

    console.log('Order created successfully:', orderId);

    await order.save();

    res.status(201).json({
      success: true,
      message: 'Sipariş başarıyla oluşturuldu',
      data: {
        order: {
          orderId: order.orderId,
          finalAmount: order.finalAmount
        }
      }
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Sipariş oluşturulurken hata oluştu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/orders - Get user's orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user._id || (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('items.productId', 'title slug');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Siparişler alınırken hata oluştu'
    });
  }
});

// GET /api/orders/:orderId - Get specific order
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user._id || (req as any).user.userId;
    const isAdmin = (req as any).user.roles?.includes('admin');

    const query: any = { orderId };
    if (!isAdmin) {
      query.userId = userId;
    }

    const order = await Order.findOne(query)
      .populate('items.productId', 'title slug')
      .populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Sipariş bulunamadı'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Sipariş alınırken hata oluştu'
    });
  }
});

// PATCH /api/orders/:orderId/status - Update order status (Admin only)
router.patch('/:orderId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Sipariş bulunamadı'
      });
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    await order.save();

    res.json({
      success: true,
      message: 'Sipariş durumu güncellendi',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Sipariş durumu güncellenirken hata oluştu'
    });
  }
});



export default router;