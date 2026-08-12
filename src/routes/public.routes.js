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
  if (config) return res.json({ success: true, data: config.value });
  
  // Provide sensible defaults if not seeded in DB
  const defaults = {
    'storeLocation': { lat: 26.4499, lng: 80.3319 },
    'deliveryChargePerKm': 10,
    'baseDeliveryFee': 20,
    'availableStates': 'Uttar Pradesh, Delhi, Maharashtra, Karnataka, Haryana, Punjab, Rajasthan, Madhya Pradesh',
    'subscriptionConfig': { minDays: 7, maxDays: 90, discountPercent: 5 },
    'footerContact': { phone: '+91 9876543210', email: 'support@milkmen.online', address: '123 Dairy Road, Kanpur, UP, 208001' },
    'helpSupport': { phone: '+91 9876543210', email: 'support@milkmen.online', hours: 'Mon - Sun, 6:00 AM - 8:00 PM', address: '123 Dairy Road, Kanpur, UP, 208001' },
    'aboutUs': 'We provide fresh, pure, and unadulterated milk directly from our farms to your doorstep every morning.',
    'faqs': [
      { q: 'What time do you deliver?', a: 'We deliver between 5:00 AM and 7:00 AM every day.' },
      { q: 'Is the milk pasteurized?', a: 'No, we provide fresh raw A2 milk. We recommend boiling it before consumption.' }
    ]
  };
  
  if (defaults[req.params.key] !== undefined) {
    return res.json({ success: true, data: defaults[req.params.key] });
  }
  
  return res.status(404).json({ success: false, message: 'Config not found' });
});

export default r;
