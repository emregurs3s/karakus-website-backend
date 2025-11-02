import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Shopier configuration
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || 'your-shopier-api-key';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || 'your-shopier-api-secret';
const SHOPIER_WEBSITE_INDEX = process.env.SHOPIER_WEBSITE_INDEX || '1';

// POST /api/payment/create-shopier-payment
router.post('/create-shopier-payment', authenticateToken, async (req, res) => {
  try {
    const { 
      cartItems, 
      totalAmount, 
      customerInfo,
      shippingAddress 
    } = req.body;

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
      buyer_id_nr: customerInfo.tcNo || '',
      buyer_address: shippingAddress.fullAddress,
      total_amount: totalAmount.toString(),
      currency: 'TL',
      platform: '1', // 1 = Web
      is_in_frame: '0',
      current_language: 'tr',
      modul_version: '1.0',
      random_nr: Math.random().toString(36).substr(2, 9),
      
      // Callback URLs
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
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

    if (payment_status === '1') {
      // Payment successful
      console.log(`Payment successful for order: ${platform_order_id}`);
      
      // Here you would:
      // 1. Update order status in database
      // 2. Send confirmation email
      // 3. Update inventory
      // 4. Create shipping label etc.
      
      res.json({
        success: true,
        message: 'Payment processed successfully'
      });
    } else {
      // Payment failed
      console.log(`Payment failed for order: ${platform_order_id}`);
      
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