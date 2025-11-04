import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import Order from '../models/Order.js';

const router = express.Router();

// Shopier configuration
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || 'your-shopier-api-key';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || 'your-shopier-api-secret';
const SHOPIER_WEBSITE_INDEX = process.env.SHOPIER_WEBSITE_INDEX || '1';

// POST /api/payment/create-shopier-payment
router.post('/create-shopier-payment', async (req, res) => {
  try {
    console.log('=== PAYMENT REQUEST RECEIVED ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', req.headers);

    const {
      amount,
      orderId,
      productName,
      name,
      email,
      phone,
      address,
      city,
      town
    } = req.body;

    // Validate required fields
    if (!amount || !orderId || !productName || !name || !email || !phone || !address || !city || !town) {
      console.error('Missing required fields:', { amount, orderId, productName, name, email, phone, address, city, town });
      return res.status(400).json({
        success: false,
        message: 'Eksik alan var',
        missing: {
          amount: !amount,
          orderId: !orderId,
          productName: !productName,
          name: !name,
          email: !email,
          phone: !phone,
          address: !address,
          city: !city,
          town: !town
        }
      });
    }

    console.log('Shopier Config:', {
      API_KEY: SHOPIER_API_KEY ? 'SET' : 'NOT SET',
      API_SECRET: SHOPIER_API_SECRET ? 'SET' : 'NOT SET',
      WEBSITE_INDEX: SHOPIER_WEBSITE_INDEX
    });

    // Clean phone number (remove mask characters)
    const cleanPhone = phone.replace(/[\s\(\)\-]/g, '');
    
    // Format amount (ensure decimal format with dot)
    const formattedAmount = parseFloat(amount).toFixed(2);

    // Clean address (remove newlines and extra spaces)
    const cleanAddress = address.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();

    console.log('Cleaned data:', {
      cleanPhone,
      formattedAmount,
      cleanAddress
    });

    // Generate random number for signature
    const randomNr = Math.random().toString(36).substring(2, 11);

    // Shopier signature: base64(HMAC_SHA256(random_nr + platform_order_id + total_amount + currency, API_SECRET))
    const signatureData = `${randomNr}${orderId}${formattedAmount}TL`;
    console.log('Signature data:', signatureData);

    const signature = crypto
      .createHmac('sha256', SHOPIER_API_SECRET)
      .update(signatureData)
      .digest('base64');

    console.log('Signature generated:', signature);

    // Prepare Shopier payment data
    const shopierData = {
      API_key: SHOPIER_API_KEY,
      website_index: SHOPIER_WEBSITE_INDEX,
      platform_order_id: orderId,
      product_name: productName,
      product_type: '1',
      buyer_name: name,
      buyer_phone: cleanPhone,
      buyer_email: email,
      buyer_account_age: '1',
      buyer_id_nr: '',
      buyer_address: cleanAddress,
      total_amount: formattedAmount,
      currency: 'TL',
      platform: '1',
      is_in_frame: '0',
      current_language: 'tr',
      modul_version: '1.0',
      random_nr: randomNr,
      signature: signature,
      callback_url: `https://karakus-website-backend.onrender.com/api/payment/shopier-callback`,
      cancel_url: `https://karakustech.com/payment/fail`,
      success_url: `https://karakustech.com/payment/success`,
      shipping_address: `${cleanAddress}, ${town}/${city}`,
      billing_address: `${cleanAddress}, ${town}/${city}`
    };

    console.log('Shopier data prepared:', shopierData);
    console.log('=== SENDING REQUEST TO SHOPIER ===');

    // Send POST request to Shopier API
    try {
      const shopierResponse = await axios.post(
        'https://www.shopier.com/ShowProduct/api_pay4.php',
        new URLSearchParams(shopierData as any).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          maxRedirects: 0,
          validateStatus: (status: number) => status >= 200 && status < 400
        }
      );

      console.log('Shopier response status:', shopierResponse.status);
      console.log('Shopier response headers:', shopierResponse.headers);
      console.log('Shopier response data:', shopierResponse.data);

      // Check if Shopier returned a redirect URL
      if (shopierResponse.headers.location) {
        console.log('Shopier redirect URL:', shopierResponse.headers.location);
        return res.json({
          success: true,
          data: {
            orderId,
            paymentUrl: shopierResponse.headers.location,
            redirectType: 'url'
          }
        });
      }

      // Check if response contains HTML with payment form
      if (typeof shopierResponse.data === 'string' && shopierResponse.data.includes('form')) {
        console.log('Shopier returned HTML form');
        return res.json({
          success: true,
          data: {
            orderId,
            paymentHtml: shopierResponse.data,
            redirectType: 'html'
          }
        });
      }

      // If response is JSON with payment URL
      if (shopierResponse.data && shopierResponse.data.payment_url) {
        console.log('Shopier payment URL:', shopierResponse.data.payment_url);
        return res.json({
          success: true,
          data: {
            orderId,
            paymentUrl: shopierResponse.data.payment_url,
            redirectType: 'url'
          }
        });
      }

      // Fallback: return form data for client-side submission
      console.log('Using fallback: client-side form submission');
      res.json({
        success: true,
        data: {
          orderId,
          shopierFormData: shopierData,
          shopierUrl: 'https://www.shopier.com/ShowProduct/api_pay4.php',
          redirectType: 'form'
        }
      });

    } catch (shopierError: any) {
      console.error('=== SHOPIER API ERROR ===');
      console.error('Error:', shopierError.message);
      console.error('Response:', shopierError.response?.data);
      console.error('Status:', shopierError.response?.status);

      // If Shopier returns 302 redirect, extract location
      if (shopierError.response?.status === 302 && shopierError.response?.headers?.location) {
        console.log('Shopier 302 redirect to:', shopierError.response.headers.location);
        return res.json({
          success: true,
          data: {
            orderId,
            paymentUrl: shopierError.response.headers.location,
            redirectType: 'url'
          }
        });
      }

      // Fallback to client-side form submission
      console.log('Shopier API error, using fallback form submission');
      res.json({
        success: true,
        data: {
          orderId,
          shopierFormData: shopierData,
          shopierUrl: 'https://www.shopier.com/ShowProduct/api_pay4.php',
          redirectType: 'form'
        }
      });
    }

  } catch (error) {
    console.error('=== SHOPIER PAYMENT ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({
      success: false,
      message: 'Ödeme oluşturulurken hata oluştu',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/payment/shopier-callback - Shopier callback handler
router.post('/shopier-callback', async (req, res) => {
  try {
    console.log('=== SHOPIER CALLBACK RECEIVED ===');
    console.log('Body:', req.body);

    const callbackData = { ...req.body };

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

    console.log('Signature verification:', {
      received: receivedSignature,
      expected: expectedSignature,
      match: receivedSignature === expectedSignature
    });

    if (receivedSignature !== expectedSignature) {
      console.error('Signature mismatch!');
      return res.status(200).send('OK'); // Shopier still expects 200
    }

    // Process payment result
    const {
      platform_order_id,
      payment_status,
      payment_id
    } = callbackData;

    console.log('Payment info:', {
      orderId: platform_order_id,
      status: payment_status,
      paymentId: payment_id
    });

    // Update order in database
    const order = await Order.findOne({ orderId: platform_order_id });

    if (!order) {
      console.error('Order not found:', platform_order_id);
      return res.status(200).send('OK'); // Still return 200 to Shopier
    }

    if (payment_status === '1') {
      // Payment successful
      console.log(`✅ Payment successful for order: ${platform_order_id}`);

      order.status = 'paid';
      order.paymentStatus = 'completed';
      order.shopierPaymentId = payment_id;
      await order.save();
    } else {
      // Payment failed
      console.log(`❌ Payment failed for order: ${platform_order_id}`);

      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
    }

    // IMPORTANT: Shopier requires 200 OK response
    res.status(200).send('OK');

  } catch (error) {
    console.error('=== SHOPIER CALLBACK ERROR ===');
    console.error('Error:', error);
    // Still return 200 to prevent Shopier from retrying
    res.status(200).send('OK');
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