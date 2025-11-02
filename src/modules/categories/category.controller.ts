import { Request, Response } from 'express';
import { Category } from './category.model.js';
import { asyncHandler } from '../../middleware/error.js';

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Category.find({ isActive: true }).sort({ ordering: 1 });

  res.json({ success: true, data: categories });
});


