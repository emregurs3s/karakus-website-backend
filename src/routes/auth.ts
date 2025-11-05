import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for login attempts - Brute force koruması
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // 15 dakikada maksimum 5 deneme
  message: {
    success: false,
    message: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // IP bazlı takip
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

// Rate limiting for registration - Spam koruması
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 3, // 1 saatte maksimum 3 kayıt
  message: {
    success: false,
    message: 'Çok fazla kayıt denemesi yaptınız. Lütfen 1 saat sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  email: z.string().email('Geçerli bir email adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı')
});

const loginSchema = z.object({
  email: z.string().email('Geçerli bir email adresi girin'),
  password: z.string().min(1, 'Şifre gerekli')
});

// POST /api/auth/register - Register user
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu email adresi zaten kullanılıyor'
      });
    }

    // Create user
    const user = new User({
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
      roles: ['user']
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Hesap başarıyla oluşturuldu',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Hesap oluşturulurken hata oluştu'
    });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user
    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email veya şifre hatalı'
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(validatedData.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email veya şifre hatalı'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş yapılırken hata oluştu'
    });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          roles: req.user.roles
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgileri alınırken hata oluştu'
    });
  }
});

export default router;