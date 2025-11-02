import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('🔗 MongoDB URI exists:', !!mongoUri);
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error);
    console.error('💡 Make sure to:');
    console.error('   1. Add your IP to MongoDB Atlas whitelist');
    console.error('   2. Check MONGODB_URI environment variable');
    console.error('   3. Verify database user permissions');
    process.exit(1);
  }
};

export default connectDB;