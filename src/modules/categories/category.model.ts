import mongoose, { Schema } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  parentId?: string;
  isActive: boolean;
  ordering: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    parentId: { type: String },
    isActive: { type: Boolean, default: true },
    ordering: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ isActive: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);


