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

    if (!amount || !orderId || !name || !email || !phone) {
      return res.status(400).send('<h1>Hata</h1><p>Eksik bilgi</p>');
    }

    console.log('=== SHOPIER PAYMENT REQUEST ===');
    console.log('Raw Query Params:', req.query);
    console.log('Amount:', amount);
    console.log('Order ID:', orderId);
    console.log('Product Name:', productName);
    console.log('Customer:', { name, email, phone });
    console.log('Address:', { address, city, town });

    // Clean data
    const cleanPhone = phone.replace(/[\s\(\)\-]/g, '');
    const cleanAddress = (address || '').replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    const formattedAmount = parseFloat(amount).toFixed(2);

    console.log('Cleaned Phone:', cleanPhone);
    console.log('Cleaned Address:', cleanAddress);
    console.log('Formatted Amount:', formattedAmount);

    // Random number
    const randomNr = Math.random().toString(36).substring(2, 11);
    console.log('Random Number:', randomNr);

    // Shopier signature: base64(HMAC_SHA256(random_nr + platform_order_id + total_amount + currency, API_SECRET))
    // DOĞRU SIRA: random_nr → platform_order_id → total_amount → currency
    // API_KEY EKLENMEZ!
    const signatureData = `${randomNr}${orderId}${formattedAmount}TL`;
    const signature = crypto
      .createHmac('sha256', SHOPIER_API_SECRET)
      .update(signatureData)
      .digest('base64');

    console.log('=== SIGNATURE CALCULATION ===');
    console.log('API Key:', SHOPIER_API_KEY);
    console.log('API Secret:', SHOPIER_API_SECRET ? '***SET***' : 'NOT SET');
    console.log('Website Index:', SHOPIER_WEBSITE_INDEX);
    console.log('Signature Data:', signatureData);
    console.log('Signature (base64):', signature);

    // Escape HTML entities
    const esc = (v: any = '') => String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Normalize product name (remove NBSP and trim)
    const safeProductName = String(productName || 'Sipariş')
      .replace(/\u00A0/g, ' ')
      .trim();

    // Shopier form fields (EXACT as documentation)
    const formFields = {
      'API_key': SHOPIER_API_KEY,
      'website_index': SHOPIER_WEBSITE_INDEX,
      'platform_order_id': orderId,
      'product_name': safeProductName,
      'product_type': '1',
      'buyer_name': name,
      'buyer_phone': cleanPhone,
      'buyer_email': email,
      'buyer_account_age': '1',
      'buyer_id_nr': '',
      'buyer_address': cleanAddress || 'Adres',
      'total_amount': formattedAmount,
      'currency': 'TL',
      'platform': '1',
      'is_in_frame': '0',
      'current_language': 'tr',
      'modul_version': '1.0',
      'random_nr': randomNr,
      'signature': signature,
      'callback_url': 'https://karakus-website-backend.onrender.com/api/payment/shopier-callback',
      'cancel_url': 'https://karakustech.com/payment/fail',
      'success_url': 'https://karakustech.com/payment/success',
      'shipping_address': `${cleanAddress}, ${town}/${city}`,
      'billing_address': `${cleanAddress}, ${town}/${city}`
    };

    console.log('=== SHOPIER FORM DATA ===');
    console.log(JSON.stringify(formFields, null, 2));
    console.log('=== SENDING TO SHOPIER ===');

    // Create form HTML with escaped values
    const formInputs = Object.entries(formFields)
      .map(([key, value]) => `    <input type="hidden" name="${esc(key)}" value="${esc(value)}">`)
      .join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ödeme Sayfasına Yönlendiriliyor</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    #error {
      display: none;
      color: red;
      margin-top: 20px;
      padding: 20px;
      background: #ffe6e6;
      border-radius: 5px;
      max-width: 600px;
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Ödeme sayfasına yönlendiriliyorsunuz...</p>
    <div id="error"></div>
  </div>
  <form id="shopierForm" method="POST" action="https://www.shopier.com/ShowProduct/api_pay4.php">
${formInputs}
  </form>
  <script>
    console.log('=== SHOPIER FORM SUBMISSION ===');
    console.log('Submitting to Shopier...');
  </script>
</body>
<script>
  // Auto-submit after page load
  window.onload = function() {
    document.getElementById('shopierForm').submit();
  };
</script>
</html>`;

    res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).send('<h1>Hata</h1><p>Bir hata oluştu</p>');
  }
});

// POST /api/payment/shopier-callback
router.post('/shopier-callback', (req, res) => {
  // HEMEN 200 dön (Shopier timeout'u sıkı)
  res.status(200).send('OK');

  // Arka planda işle
  setImmediate(async () => {
    try {
      console.log('=== SHOPIER CALLBACK ===');
      console.log('Body:', req.body);

      const { platform_order_id, payment_status, payment_id } = req.body;

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
      } else {
        console.log('⚠️ Order not found:', platform_order_id);
      }
    } catch (error) {
      console.error('Callback processing error:', error);
    }
  });
});

export default router;
