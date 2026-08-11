import { Router } from 'express';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { ContactInquiry } from '../models/ContactInquiry.js';
import { SystemConfig } from '../models/SystemConfig.js';

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

r.post('/contact', async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  const inquiry = await ContactInquiry.create({ name, email, phone, subject, message });
  res.status(201).json({ success: true, data: inquiry });
});

r.get('/config/:key', async (req, res) => {
  const config = await SystemConfig.findOne({ key: req.params.key });
  if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
  res.json({ success: true, data: config.value });
});

export default r;
