import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

const router = express.Router();

// In-memory store for reset tokens (production'da Redis kullan)
const resetTokens = new Map<string, { email: string; expires: number }>();

// POST /api/password/forgot - Request password reset
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email adresi gerekli'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Güvenlik: Email bulunamasa bile başarılı mesaj dön
      return res.json({
        success: true,
        message: 'Eğer bu email kayıtlıysa, şifre sıfırlama linki gönderildi'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour

    // Store token
    resetTokens.set(resetToken, { email, expires });

    // Reset link
    const resetLink = `${process.env.FRONTEND_URL || 'https://karakustech.com'}/reset-password?token=${resetToken}`;

    console.log('=== PASSWORD RESET ===');
    console.log('Email:', email);
    console.log('Reset Link:', resetLink);
    console.log('Token expires in 1 hour');

    // Send email with nodemailer
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: '"Karakuş Tech" <emregurses06@gmail.com>',
        to: email,
        subject: 'Şifre Sıfırlama - Karakuş Tech',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Şifre Sıfırlama</h2>
            <p>Merhaba,</p>
            <p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Şifremi Sıfırla
            </a>
            <p>Veya bu linki kopyalayın: <a href="${resetLink}">${resetLink}</a></p>
            <p style="color: #666; font-size: 14px;">Bu link 1 saat geçerlidir.</p>
            <p style="color: #666; font-size: 14px;">Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">Karakuş Tech</p>
          </div>
        `
      });

      console.log('✅ Password reset email sent to:', email);
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Email gönderilemese bile devam et
    }

    res.json({
      success: true,
      message: 'Şifre sıfırlama linki email adresinize gönderildi',
      // Development için token'ı dön (production'da kaldır)
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Bir hata oluştu'
    });
  }
});

// POST /api/password/reset - Reset password with token
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token ve yeni şifre gerekli'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Şifre en az 6 karakter olmalı'
      });
    }

    // Check token
    const tokenData = resetTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token'
      });
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(token);
      return res.status(400).json({
        success: false,
        message: 'Token süresi dolmuş'
      });
    }

    // Update password
    const user = await User.findOne({ email: tokenData.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    user.password = password;
    await user.save();

    // Delete token
    resetTokens.delete(token);

    console.log('Password reset successful for:', tokenData.email);

    res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre güncellenirken hata oluştu'
    });
  }
});

export default router;
