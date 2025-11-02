import mongoose from 'mongoose';
import { config } from 'dotenv';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

config();

const categories = [
  {
    name: 'Şarj Aletleri',
    slug: 'sarj-aletleri',
    image: '/images/categories/sarj.jpg',
    isActive: true,
    ordering: 1
  },
  {
    name: 'Airpods & Kulaklık',
    slug: 'airpods-kulaklik',
    image: '/images/categories/kulakliklar.jpg',
    isActive: true,
    ordering: 2
  },
  {
    name: 'Powerbank',
    slug: 'powerbank',
    image: '/images/categories/powerbank.jpg',
    isActive: true,
    ordering: 3
  }
];

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Category.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    console.log('Cleared existing data');

    // Insert categories
    const insertedCategories = await Category.insertMany(categories);
    console.log('Categories inserted');

    // Get category IDs
    const sarjAletleriCategory = insertedCategories.find(cat => cat.slug === 'sarj-aletleri')?._id;
    const airpodsKulaklikCategory = insertedCategories.find(cat => cat.slug === 'airpods-kulaklik')?._id;
    const powerbankCategory = insertedCategories.find(cat => cat.slug === 'powerbank')?._id;

    // Insert products - Sizin orijinal ürünleriniz
    const products = [
      {
        title: 'Orjinal iPhone Şarj Kablosu',
        slug: 'orjinal-iphone-sarj-kablosu',
        description: 'BU ÜRÜNÜ ALARAK ÇEKİLİŞE BİR HAK KAZANABİLİRSİNİZ NE KADAR ALIRSANIZ B…',
        price: 150,
        originalPrice: 160,
        images: ['/uploads/images-1762031631005-505086129.jpg'],
        category: sarjAletleriCategory,
        colors: [],
        sizes: ['Standart'],
        stock: 20,
        sku: 'Kablo1',
        isNew: true,
        isBestSeller: false,
        isActive: true,
        rating: 5,
        reviewCount: 0
      },
      {
        title: 'APPLE MAGSAFE POWERBANK',
        slug: 'apple-magsafe-powerbank',
        description: 'iPhone\'unuz için kablosuz ve manyetik şarj kolaylığı! Güçlü 10000 mAh …',
        price: 700,
        originalPrice: 799,
        images: ['/uploads/images-1762031733194-779001812.jpg'],
        category: powerbankCategory,
        colors: [],
        sizes: ['10000mAh'],
        stock: 20,
        sku: 'Powerbank1',
        isNew: true,
        isBestSeller: false,
        isActive: true,
        rating: 5,
        reviewCount: 0
      },
      {
        title: 'Airpods max ANC',
        slug: 'airpods-max-anc',
        description: 'Kargo bedeli teslimat esnasında alıcı tarafından kapıda ödenir.',
        price: 899,
        originalPrice: 1250,
        images: ['/uploads/images-1762031631005-505086129.jpg'],
        category: airpodsKulaklikCategory,
        colors: [],
        sizes: ['Standart'],
        stock: 20,
        sku: 'AirpodsMaxANC1',
        isNew: true,
        isBestSeller: true,
        isActive: true,
        rating: 5,
        reviewCount: 0
      },
      {
        title: 'Airpods Pro ANC',
        slug: 'airpods-4-nesil-anc',
        description: 'Kargo bedeli teslimat esnasında alıcı tarafından kapıda ödenir.',
        price: 899,
        originalPrice: 1250,
        images: ['/uploads/images-1762031858085-690994937.jpg', '/uploads/images-1762031859857-486472262.jpg'],
        category: airpodsKulaklikCategory,
        colors: [],
        sizes: ['Standart'],
        stock: 20,
        sku: 'AirpodsProANC1',
        isNew: true,
        isBestSeller: false,
        isActive: true,
        rating: 5,
        reviewCount: 0
      }
    ];

    await Product.insertMany(products);
    console.log('Products inserted');

    // Create admin user
    const adminUser = new User({
      name: 'Admin',
      email: 'admin@karakustech.com',
      password: 'admin123',
      roles: ['admin', 'user']
    });
    await adminUser.save();
    console.log('Admin user created');

    // Create regular user
    const regularUser = new User({
      name: 'Test User',
      email: 'user@karakustech.com',
      password: 'user123',
      roles: ['user']
    });
    await regularUser.save();
    console.log('Regular user created');

    console.log('✅ Seed data inserted successfully!');
    console.log('👤 Admin: admin@karakustech.com / admin123');
    console.log('👤 User: user@karakustech.com / user123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed data error:', error);
    process.exit(1);
  }
};

seedData();