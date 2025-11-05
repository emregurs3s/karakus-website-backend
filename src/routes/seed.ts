import express from 'express';
import seedData from '../scripts/seedData.js';

const router = express.Router();

// GET /api/seed/run - Run seed data (ONLY FOR DEVELOPMENT/SETUP)
router.get('/run', async (req, res) => {
  try {
    // Security check - only allow in development or with secret key
    const secretKey = req.query.secret;
    
    if (process.env.NODE_ENV === 'production' && secretKey !== process.env.SEED_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    console.log('Running seed data...');
    
    // Run seed data
    await seedData();
    
    res.json({
      success: true,
      message: 'Seed data inserted successfully!',
      admin: {
        email: 'admin@karakustech.com',
        note: 'Check seed data file for password'
      }
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Seed data failed'
    });
  }
});

export default router;
