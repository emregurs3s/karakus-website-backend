import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// PUT /api/user/profile - Update user profile
router.put('/profile', authenticateToken, async (req: any, res) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'Güncellenecek alan belirtilmedi'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Bu email adresi zaten kullanılıyor'
        });
      }
      user.email = email;
    }

    if (name) {
      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'İsim en az 2 karakter olmalı'
        });
      }
      user.name = name;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Profil güncellenirken hata oluştu'
    });
  }
});

// PUT /api/user/password - Change password
router.put('/password', authenticateToken, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut şifre ve yeni şifre gerekli'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Yeni şifre en az 6 karakter olmalı'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Mevcut şifre hatalı'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Şifre başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre güncellenirken hata oluştu'
    });
  }
});

export default router;
