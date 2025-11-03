import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import Order from '../models/Order.js';

const router = express.Router();

// Shopier configuration
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || 'your-shopier-api-key';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || 'your-shopier-api-secret';
const SHOPIER_WEBSITE_INDEX = process.env.SHOPIER_WEBSITE_INDEX || '1';

// POST /api/payment/create-shopier-payment
router.post('/create-shopier-payment', authenticateToken, async (req, res) => {
  try {
    console.log('Payment request received:', req.body);
    
    const { 
      cartItems, 
      totalAmount, 
      customerInfo,
      shippingAddress 
    } = req.body;
    
    console.log('Shopier Config:', {
      API_KEY: SHOPIER_API_KEY,
      API_SECRET: SHOPIER_API_SECRET ? 'SET' : 'NOT SET',
      WEBSITE_INDEX: SHOPIER_WEBSITE_INDEX
    });

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate shipping cost
    const shippingCost = totalAmount >= 500 ? 0 : 29.90;
    const finalAmount = totalAmount + shippingCost;
    
    // Create order in database
    const order = new Order({
      orderId,
      userId: (req as any).user.userId,
      customerInfo,
      shippingAddress,
      items: cartItems.map((item: any) => ({
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
      paymentMethod: 'shopier'
    });
    
    await order.save();
    
    // Prepare Shopier payment data
    const shopierData = {
      API_key: SHOPIER_API_KEY,
      website_index: SHOPIER_WEBSITE_INDEX,
      platform_order_id: orderId,
      product_name: `Karakuş Tech - Sipariş #${orderId}`,
      product_type: '1', // 1 = Fiziksel ürün
      buyer_name: customerInfo.name,
      buyer_phone: customerInfo.phone,
      buyer_email: customerInfo.email,
      buyer_account_age: '1', // Hesap yaşı (gün)
      buyer_id_nr: '', // TC kimlik no kaldırıldı
      buyer_address: shippingAddress.fullAddress,
      total_amount: finalAmount.toString(),
      currency: 'TL',
      platform: '1', // 1 = Web
      is_in_frame: '0',
      current_language: 'tr',
      modul_version: '1.0',
      random_nr: Math.random().toString(36).substr(2, 9),
      
      // Callback URLs
      callback_url: `https://karakus-website-backend.onrender.com/api/payment/shopier-callback`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/fail`,
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      
      // Shipping info
      shipping_address: shippingAddress.fullAddress,
      billing_address: shippingAddress.fullAddress,
    };

    // Generate signature for Shopier
    const signatureString = Object.keys(shopierData)
      .sort()
      .map(key => `${key}=${shopierData[key as keyof typeof shopierData]}`)
      .join('&');
    
    const signature = crypto
      .createHmac('sha256', SHOPIER_API_SECRET)
      .update(signatureString)
      .digest('hex');

    // Add signature to data
    const finalData = {
      ...shopierData,
      signature
    };

    // Return payment form data
    res.json({
      success: true,
      data: {
        orderId,
        shopierFormData: finalData,
        shopierUrl: 'https://www.shopier.com/ShowProduct/api_pay4.php'
      }
    });

  } catch (error) {
    console.error('Shopier payment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme oluşturulurken hata oluştu'
    });
  }
});

// POST /api/payment/shopier-callback - Shopier callback handler
router.post('/shopier-callback', async (req, res) => {
  try {
    const callbackData = req.body;
    
    // Verify signature
    const receivedSignature = callbackData.signature;
    delete callbackData.signature;
    
    const signatureString = Object.keys(callbackData)
      .sort()
      .map(key => `${key}=${callbackData[key]}`)
      .join('&');
    
    const expectedSignature = crypto
      .createHmac('sha256', SHOPIER_API_SECRET)
      .update(signatureString)
      .digest('hex');

    if (receivedSignature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Process payment result
    const { 
      platform_order_id, 
      payment_status, 
      payment_id,
      total_amount 
    } = callbackData;

    // Update order in database
    const order = await Order.findOne({ orderId: platform_order_id });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (payment_status === '1') {
      // Payment successful
      console.log(`Payment successful for order: ${platform_order_id}`);
      
      order.status = 'paid';
      order.paymentStatus = 'completed';
      order.shopierPaymentId = payment_id;
      await order.save();
      
      res.json({
        success: true,
        message: 'Payment processed successfully'
      });
    } else {
      // Payment failed
      console.log(`Payment failed for order: ${platform_order_id}`);
      
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
      
      res.json({
        success: false,
        message: 'Payment failed'
      });
    }

  } catch (error) {
    console.error('Shopier callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Callback processing error'
    });
  }
});

// GET /api/payment/verify/:orderId - Verify payment status
router.get('/verify/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Here you would check the order status in your database
    // For now, returning a mock response
    
    res.json({
      success: true,
      data: {
        orderId,
        status: 'pending', // pending, completed, failed, cancelled
        paymentId: null,
        amount: 0
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme doğrulaması yapılırken hata oluştu'
    });
  }
});

export default router;