import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';

const router = express.Router();

// Shopier configuration
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || '';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || '';
const SHOPIER_WEBSITE_INDEX = process.env.SHOPIER_WEBSITE_INDEX || '1';

// GET /api/payment/create-shopier-payment
router.get('/create-shopier-payment', async (req, res) => {
  try {
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
    } = req.query as any;

    // Validate
    if (!amount || !orderId || !productName || !name || !email || !phone || !address || !city || !town) {
      return res.status(400).send('<h1>Hata</h1><p>Eksik bilgi. Lütfen geri dönün ve formu doldurun.</p>');
    }

    // Clean data
    const cleanPhone = phone.replace(/[\s\(\)\-]/g, '');
    const cleanAddress = address.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    const formattedAmount = parseFloat(amount).toFixed(2);

    // Generate random number
    const randomNr = Math.random().toString(36).substring(2, 11);

    // Shopier signature: HMAC_SHA256(API_key + random_nr + total_amount + order_id, API_SECRET)
    const signatureData = `${SHOPIER_API_KEY}${randomNr}${formattedAmount}${orderId}`;
    const signature = crypto
      .createHmac('sha256', SHOPIER_API_SECRET)
      .update(signatureData)
      .digest('base64');

    // Shopier form data
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
      callback_url: 'https://karakus-website-backend.onrender.com/api/payment/shopier-callback',
      cancel_url: 'https://karakustech.com/payment/cancel',
      success_url: 'https://karakustech.com/payment/success',
      shipping_address: `${cleanAddress}, ${town}/${city}`,
      billing_address: `${cleanAddress}, ${town}/${city}`
    };

    // Create HTML form
    const formInputs = Object.entries(shopierData)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
      .join('\n    ');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ödeme Sayfasına Yönlendiriliyor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      color: white;
      padding: 40px;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 { font-size: 28px; margin-bottom: 15px; }
    p { font-size: 16px; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Ödeme Sayfasına Yönlendiriliyor</h1>
    <p>Lütfen bekleyin...</p>
  </div>
  <form id="paymentForm" method="POST" action="https://www.shopier.com/ShowProduct/api_pay4.php">
    ${formInputs}
  </form>
  <script>
    setTimeout(function() {
      document.getElementById('paymentForm').submit();
    }, 1000);
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).send('<h1>Hata</h1><p>Bir hata oluştu. Lütfen tekrar deneyin.</p>');
  }
});

// POST /api/payment/shopier-callback
router.post('/shopier-callback', async (req, res) => {
  try {
    console.log('=== SHOPIER CALLBACK ===');
    console.log('Data:', req.body);

    const { platform_order_id, payment_status, payment_id } = req.body;

    // Update order in database
    const order = await Order.findOne({ orderId: platform_order_id });
    
    if (order) {
      if (payment_status === '1') {
        order.status = 'paid';
        order.paymentStatus = 'completed';
        order.shopierPaymentId = payment_id;
        console.log('✅ Payment successful:', platform_order_id);
      } else {
        order.status = 'cancelled';
        order.paymentStatus = 'failed';
        console.log('❌ Payment failed:', platform_order_id);
      }
      await order.save();
    }

    // Shopier requires 200 OK
    res.status(200).send('OK');

  } catch (error) {
    console.error('Callback error:', error);
    res.status(200).send('OK');
  }
});

export default router;
