import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = express.Router();

// GET /api/products - Get all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    // Build filter object
    const filter: any = { isActive: true };

    // Category filter
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(sort)
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
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürünler alınırken hata oluştu'
    });
  }
});

// GET /api/products/:slug - Get product by slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    }).populate('category', 'name slug');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Ürün alınırken hata oluştu'
    });
  }
});

// GET /api/products/featured/bestsellers - Get best seller products
router.get('/featured/bestsellers', async (req, res) => {
  try {
    const products = await Product.find({ 
      isActive: true, 
      isBestSeller: true 
    })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(8);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get bestsellers error:', error);
    res.status(500).json({
      success: false,
      message: 'En çok satanlar alınırken hata oluştu'
    });
  }
});

export default router;