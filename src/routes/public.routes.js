import { Router } from 'express';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';

const r = Router();

r.get('/categories', async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort('displayOrder');
  res.json({ success: true, data: categories });
});


r.get('/products', async (req, res) => {
  const products = await Product.find({ isActive: true }).sort('-createdAt');
  res.json({ success: true, data: products });
});

r.get('/products/:id', async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).populate('category');
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: product });
});

r.get('/subscription-plans', async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).populate('product').sort('-createdAt');
  res.json({ success: true, data: plans });
});

export default r;
