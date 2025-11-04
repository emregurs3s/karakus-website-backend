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
    image: 'https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Categories/Şarj.jpg',
    isActive: true,
    ordering: 1
  },
  {
    name: 'Airpods & Kulaklık',
    slug: 'airpods-kulaklik',
    image: 'https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Categories/Kulaklıklar.jpg',
    isActive: true,
    ordering: 2
  },
  {
    name: 'Powerbank',
    slug: 'powerbank',
    image: 'https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Categories/Powerbank.jpg',
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

    // Insert products - Güncel ürünleriniz
    const products = [
      {
        title: 'Orjinal iPhone Şarj Kablosu',
        slug: 'orjinal-iphone-sarj-kablosu',
        description: 'BU ÜRÜNÜ ALARAK ÇEKİLİŞE BİR HAK KAZANABİLİRSİNİZ NE KADAR ALIRSANIZ B…',
        price: 150,
        originalPrice: 160,
        images: ['https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Products/IMG-20251101-WA0011.jpg'],
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
        images: ['https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Products/IMG-20251101-WA0012.jpg'],
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
        images: ['https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Products/IMG-20251101-WA0013.jpg'],
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
        images: ['https://raw.githubusercontent.com/emregurs3s/karakus-images/main/Products/IMG-20251101-WA0014.jpg'],
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

    // Create admin user - GÜÇLÜ ŞİFRE KULLANIN!
    const adminUser = new User({
      name: 'karakustech',
      email: 'admin@karakustech.com',
      password: 'aliqq123456789AEK', // Güçlü şifre
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
    console.log('👤 Admin: admin@karakustech.com / [ŞİFRE GİZLİ]');
    console.log('👤 User: user@karakustech.com / user123');

    // Close connection and exit
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed data error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Export for use in endpoint
export default seedData;

// Run directly if this file is executed
seedData();
