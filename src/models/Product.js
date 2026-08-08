import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  unit: { type: String, required: true }, // e.g. '500 ml', '1 litre', 'Bottle'
  sku: { type: String },
  regularPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  stockQuantity: { type: Number, default: 0, min: 0 }
});

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
  shortDescription: { type: String },
  fullDescription: { type: String },
  benefits: { type: String },
  ingredients: { type: String },
  nutritionalInfo: { type: String },
  storageInstructions: { type: String },
  expiryInfo: { type: String },
  sku: { type: String },
  
  images: [{ type: String }],
  
  taxPercentage: { type: Number, default: 0 },
  minOrderQuantity: { type: Number, default: 1 },
  maxOrderQuantity: { type: Number, default: 100 },
  
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  allowSubscription: { type: Boolean, default: true },
  allowCustomBulk: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  variants: [variantSchema],
  
  // Legacy fields for backwards compatibility with existing frontend components
  colorTheme: { type: String, default: 'bg-white' },
  unit: { type: String },
  pricePerUnit: { type: Number },
  imageUrl: { type: String }
}, { timestamps: true });

export const Product = mongoose.model('Product', schema);
