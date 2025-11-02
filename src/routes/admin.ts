import express from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { uploadMultiple, uploadSingle } from '../middleware/upload.js';

const router = express.Router();

// POST /api/admin/upload/single - DISABLED: Use URL input instead
router.post('/upload/single', authenticateToken, requireAdmin, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'File upload disabled. Please use image URLs from GitHub repository.'
  });
});

// POST /api/admin/upload/multiple - DISABLED: Use URL input instead  
router.post('/upload/multiple', authenticateToken, requireAdmin, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'File upload disabled. Please use image URLs from GitHub repository.'
  });
});

// DELETE /api/admin/upload/:filename - DISABLED: Use URL input instead
router.delete('/upload/:filename', authenticateToken, requireAdmin, async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'File deletion disabled. Images are hosted on GitHub.'
  });
});

// Apply auth middleware to all other admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Product validation schema
const productSchema = z.object({
  title: z.string().min(1, 'Ürün adı gerekli'),
  slug: z.string().min(1, 'Slug gerekli'),
  description: z.string().min(1, 'Açıklama gerekli'),
  price: z.number().min(0, 'Fiyat 0\'dan büyük olmalı'),
  originalPrice: z.number().optional(),
  images: z.array(z.string()).min(1, 'En az bir resim gerekli'),
  category: z.string().min(1, 'Kategori gerekli'),
  colors: z.array(z.string()).optional().default([]),
  sizes: z.array(z.string()).optional().default(['Standart']),
  stock: z.number().min(0, 'Stok 0\'dan küçük olamaz'),
  sku: z.string().min(1, 'SKU gerekli'),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional()
});

// GET /api/admin/dashboard - Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [totalProducts, totalUsers, totalCategories, activeProducts] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments({ isActive: true })
    ]);

    const lowStockProducts = await Product.countDocuments({ stock: { $lt: 10 } });

    res.json({
      success: true,
      data: {
        totalProducts,
        totalUsers,
        totalCategories,
        activeProducts,
        lowStockProducts
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Dashboard verileri alınırken hata oluştu'
    });
  }
});

// GET /api/admin/products - Get all products for admin
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    
    const filter: any = {};
    
    if (search) {
      filter.$text = { $search: search as string };
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürünler alınırken hata oluştu'
    });
  }
});

// POST /api/admin/products - Create product
router.post('/products', async (req, res) => {
  try {
    const validatedData = productSchema.parse(req.body);
    
    // Check if slug already exists
    const existingProduct = await Product.findOne({ slug: validatedData.slug });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Bu slug zaten kullanılıyor'
      });
    }

    const product = new Product(validatedData);
    await product.save();
    
    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Ürün başarıyla oluşturuldu',
      data: product
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürün oluşturulurken hata oluştu'
    });
  }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', async (req, res) => {
  try {
    // Önce ürünün var olup olmadığını kontrol et
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı'
      });
    }

    const validatedData = productSchema.parse(req.body);
    
    // Check if SKU already exists for another product
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const duplicateSku = await Product.findOne({ 
        sku: validatedData.sku, 
        _id: { $ne: req.params.id } 
      });
      
      if (duplicateSku) {
        return res.status(400).json({
          success: false,
          message: 'Bu SKU zaten başka bir ürün tarafından kullanılıyor'
        });
      }
    }

    // Check if slug already exists for another product
    if (validatedData.slug && validatedData.slug !== existingProduct.slug) {
      const duplicateSlug = await Product.findOne({ 
        slug: validatedData.slug, 
        _id: { $ne: req.params.id } 
      });
      
      if (duplicateSlug) {
        return res.status(400).json({
          success: false,
          message: 'Bu URL adı zaten başka bir ürün tarafından kullanılıyor'
        });
      }
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

    res.json({
      success: true,
      message: 'Ürün başarıyla güncellendi',
      data: updatedProduct
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Bu ${field === 'sku' ? 'SKU' : field === 'slug' ? 'URL adı' : field} zaten kullanılıyor`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Ürün güncellenirken hata oluştu'
    });
  }
});

// PATCH /api/admin/products/:id/toggle - Toggle product active status
router.patch('/products/:id/toggle', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı'
      });
    }

    product.isActive = !product.isActive;
    await product.save();
    
    await product.populate('category', 'name slug');

    res.json({
      success: true,
      message: `Ürün ${product.isActive ? 'aktif' : 'pasif'} hale getirildi`,
      data: product
    });
  } catch (error) {
    console.error('Toggle product error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürün durumu değiştirilirken hata oluştu'
    });
  }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı'
      });
    }

    res.json({
      success: true,
      message: 'Ürün başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürün silinirken hata oluştu'
    });
  }
});

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar alınırken hata oluştu'
    });
  }
});

export default router;