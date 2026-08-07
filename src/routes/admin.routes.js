import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { Delivery } from '../models/Delivery.js';
import { Subscription } from '../models/Subscription.js';
import { Payment } from '../models/Payment.js';
import { Category } from '../models/Category.js';
import { upload } from '../config/cloudinary.js';

const r=Router();r.use(requireAuth('admin'));

r.get('/dashboard', async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1. Basic Stats
  const customers = await User.countDocuments({ role: 'customer' });
  const partners = await User.countDocuments({ role: 'partner' });
  const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
  const todayDeliveries = await Delivery.countDocuments({ deliveryDate: { $gte: todayStart } });
  
  const revenueAgg = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const revenue = revenueAgg[0]?.total || 0;

  // 2. Revenue Analytics (Last 7 Days)
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  
  const revenueByDay = await Payment.aggregate([
    { $match: { status: 'paid', createdAt: { $gte: sevenDaysAgo } } },
    { $group: { 
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
        total: { $sum: '$amount' } 
    }},
    { $sort: { '_id': 1 } }
  ]);
  
  const revenueAnalytics = [];
  let maxRevenue = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const match = revenueByDay.find(r => r._id === dateStr);
    const dayRevenue = match ? match.total : 0;
    if (dayRevenue > maxRevenue) maxRevenue = dayRevenue;
    revenueAnalytics.push({ day: dayName, revenue: dayRevenue, date: dateStr });
  }

  // 3. Top Selling Products
  const topProductsAgg = await Subscription.aggregate([
    { $match: { status: { $in: ['active', 'completed'] } } },
    { $group: { _id: '$product', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails' } },
    { $unwind: '$productDetails' },
    { $project: { name: '$productDetails.name', sales: '$count', stock: 'In Stock', color: 'bg-green-100 text-green-700' } }
  ]);

  // 4. Delivery Status (Today)
  const deliveryStatusAgg = await Delivery.aggregate([
    { $match: { deliveryDate: { $gte: todayStart } } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  let completedDeliveries = 0;
  deliveryStatusAgg.forEach(d => {
    if (d._id === 'delivered') completedDeliveries += d.count;
  });

  // 5. Zones (Based on pincodes)
  const zonesAgg = await User.aggregate([
    { $match: { role: 'customer' } },
    { $unwind: '$addresses' },
    { $group: { _id: '$addresses.pincode', customers: { $sum: 1 } } },
    { $sort: { customers: -1 } },
    { $limit: 3 },
    { $project: { name: { $concat: ['Zone ', '$_id'] }, pin: '$_id', partners: '$customers', active: true } }
  ]);

  res.json({
    success: true,
    data: {
      customers,
      partners,
      activeSubscriptions,
      todayDeliveries,
      revenue,
      revenueAnalytics,
      maxRevenue: maxRevenue || 1, // avoid div by 0
      topProducts: topProductsAgg,
      deliveryStatus: {
        total: todayDeliveries,
        completed: completedDeliveries,
        percentage: todayDeliveries > 0 ? Math.round((completedDeliveries / todayDeliveries) * 100) : 0
      },
      zones: zonesAgg.length > 0 ? zonesAgg : [
        { name: 'North Zone', pin: '110001', partners: 4, active: true },
        { name: 'South Zone', pin: '110016', partners: 3, active: true },
        { name: 'East Zone', pin: '110092', partners: 2, active: false }
      ]
    }
  });
});
r.get('/users',async(req,res)=>res.json({success:true,data:await User.find(req.query.role?{role:req.query.role}:{})}));

r.get('/categories', async(req,res)=>res.json({success:true,data:await Category.find().sort('displayOrder')}));
r.post('/categories', upload.single('image'), async(req,res)=>{
  const categoryData = req.body;
  if (req.file) categoryData.image = req.file.path;
  res.status(201).json({success:true,data:await Category.create(categoryData)});
});
r.patch('/categories/:id', upload.single('image'), async(req,res)=>{
  const updateData = req.body;
  if (req.file) updateData.image = req.file.path;
  res.json({success:true,data:await Category.findByIdAndUpdate(req.params.id,{$set:updateData},{new:true})});
});
r.delete('/categories/:id', async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

r.get('/products',async(req,res)=>res.json({success:true,data:await Product.find().populate('category').sort('-createdAt')}));
r.post('/products', upload.array('images', 5), async(req,res)=>{
  const productData = { ...req.body };
  if (req.files && req.files.length > 0) {
    productData.images = req.files.map(f => f.path);
  }
  if (typeof productData.variants === 'string') {
    try { productData.variants = JSON.parse(productData.variants); } catch(e){}
  }
  ['isFeatured', 'isBestSeller', 'allowSubscription', 'isActive'].forEach(field => {
    if (productData[field] === 'true') productData[field] = true;
    if (productData[field] === 'false') productData[field] = false;
  });
  if (productData.category === '') delete productData.category;
  
  res.status(201).json({success:true,data:await Product.create(productData)});
});
r.patch('/products/:id', upload.array('images', 5), async(req,res)=>{
  const updateData = { ...req.body };
  if (req.files && req.files.length > 0) {
    updateData.images = req.files.map(f => f.path);
  }
  if (typeof updateData.variants === 'string') {
    try { updateData.variants = JSON.parse(updateData.variants); } catch(e){}
  }
  ['isFeatured', 'isBestSeller', 'allowSubscription', 'isActive'].forEach(field => {
    if (updateData[field] === 'true') updateData[field] = true;
    if (updateData[field] === 'false') updateData[field] = false;
  });
  if (updateData.category === '') updateData.category = null;
  
  res.json({success:true,data:await Product.findByIdAndUpdate(req.params.id,{$set:updateData},{new:true})});
});
r.delete('/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

r.get('/subscription-plans', async(req,res)=>res.json({success:true,data:await SubscriptionPlan.find().populate('product').sort('-createdAt')}));
r.post('/subscription-plans', upload.single('image'), async(req,res)=>{
  const planData = { ...req.body };
  if (req.file) planData.image = req.file.path;
  if (typeof planData.selectedWeekdays === 'string') {
    try { planData.selectedWeekdays = JSON.parse(planData.selectedWeekdays); } catch(e){}
  }
  ['isActive', 'isFeatured', 'isRecommended'].forEach(field => {
    if (planData[field] === 'true') planData[field] = true;
    if (planData[field] === 'false') planData[field] = false;
  });
  res.status(201).json({success:true,data:await SubscriptionPlan.create(planData)});
});
r.patch('/subscription-plans/:id', upload.single('image'), async(req,res)=>{
  const updateData = { ...req.body };
  if (req.file) updateData.image = req.file.path;
  if (typeof updateData.selectedWeekdays === 'string') {
    try { updateData.selectedWeekdays = JSON.parse(updateData.selectedWeekdays); } catch(e){}
  }
  ['isActive', 'isFeatured', 'isRecommended'].forEach(field => {
    if (updateData[field] === 'true') updateData[field] = true;
    if (updateData[field] === 'false') updateData[field] = false;
  });
  res.json({success:true,data:await SubscriptionPlan.findByIdAndUpdate(req.params.id,{$set:updateData},{new:true})});
});
r.delete('/subscription-plans/:id', async (req, res) => {
  await SubscriptionPlan.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

r.get('/active-subscriptions', async (req, res) => {
  res.json({
    success: true,
    data: await Subscription.find().populate('customer product assignedPartner').sort('-createdAt')
  });
});

r.patch('/active-subscriptions/:id/assign-partner', async (req, res) => {
  const { partnerId } = req.body;
  const sub = await Subscription.findByIdAndUpdate(
    req.params.id,
    { $set: { assignedPartner: partnerId || null } },
    { new: true }
  );
  
  if (sub) {
    // Cascade assignment to all pending/scheduled deliveries
    await Delivery.updateMany(
      { subscription: sub._id, status: { $in: ['scheduled', 'rescheduled', 'pending'] } },
      { $set: { partner: partnerId || null, status: partnerId ? 'assigned' : 'scheduled' } }
    );
  }
  
  res.json({ success: true, data: sub });
});

r.patch('/active-subscriptions/:id/slot', async (req, res) => {
  const { slot } = req.body;
  const sub = await Subscription.findByIdAndUpdate(
    req.params.id,
    { $set: { slot: slot } },
    { new: true }
  );
  
  if (sub) {
    // Cascade slot update to all future/pending deliveries
    await Delivery.updateMany(
      { subscription: sub._id, status: { $in: ['scheduled', 'assigned', 'rescheduled', 'pending'] } },
      { $set: { slot: slot } }
    );
  }
  
  res.json({ success: true, data: sub });
});

r.get('/deliveries', async(req, res) => {
  const filter = {};
  if (req.query.subscriptionId) {
    filter.subscription = req.query.subscriptionId;
  }
  res.json({
    success: true, 
    data: await Delivery.find(filter).populate('customer partner product').sort('deliveryDate')
  });
});
r.patch('/deliveries/:id/assign', async (req, res) => {
  const { partnerId } = req.body;
  const status = partnerId ? 'assigned' : 'scheduled';
  res.json({
    success: true,
    data: await Delivery.findByIdAndUpdate(
      req.params.id,
      { $set: { partner: partnerId || null, status } },
      { new: true }
    )
  });
});
r.patch('/deliveries/:id/reschedule', async (req, res) => {
  const { deliveryDate, slot } = req.body;
  res.json({
    success: true,
    data: await Delivery.findByIdAndUpdate(req.params.id, {
      $set: { deliveryDate, slot: slot || 'Pending Allocation', status: 'rescheduled', failureReason: null, partner: null }
    }, { new: true })
  });
});
export default r;
