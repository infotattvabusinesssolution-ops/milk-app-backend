import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { MilkSale } from '../models/MilkSale.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { upload } from '../config/cloudinary.js';

const r = Router();
r.use(requireAuth('farmer'));

// Profile
r.get('/profile', async (req, res) => {
  const p = await FarmerProfile.findOne({ user: req.auth.id });
  res.json({ success: true, data: p });
});

r.post('/profile', async (req, res) => {
  const p = await FarmerProfile.findOneAndUpdate(
    { user: req.auth.id },
    { $set: { ...req.body, user: req.auth.id } },
    { new: true, upsert: true }
  );
  res.json({ success: true, data: p });
});

// Profile Photo Upload
r.post('/profile-photo', upload.single('photo'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No photo provided');
  const p = await FarmerProfile.findOneAndUpdate(
    { user: req.auth.id },
    { $set: { profilePhotoUrl: req.file.path } },
    { new: true }
  );
  res.json({ success: true, data: p });
});

// KYC Upload
r.post('/kyc', upload.fields([{ name: 'aadhaarFront', maxCount: 1 }, { name: 'aadhaarBack', maxCount: 1 }]), async (req, res) => {
  const p = await FarmerProfile.findOne({ user: req.auth.id });
  if (!p) throw new ApiError(404, 'Profile not found. Please setup profile first.');
  
  if (req.files['aadhaarFront']) p.kyc.aadhaarFrontUrl = req.files['aadhaarFront'][0].path;
  if (req.files['aadhaarBack']) p.kyc.aadhaarBackUrl = req.files['aadhaarBack'][0].path;
  p.kyc.status = 'pending';
  await p.save();
  
  res.json({ success: true, data: p });
});

// Dashboard
r.get('/dashboard', async (req, res) => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const sales = await MilkSale.find({ farmer: req.auth.id, createdAt: { $gte: startOfMonth } });
  
  const completedSales = sales.filter(s => s.status === 'collected');
  
  const totalEarningsThisMonth = completedSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalMilkSoldThisMonth = completedSales.reduce((acc, s) => acc + s.quantity, 0);
  
  const recentTransactions = await MilkSale.find({ farmer: req.auth.id }).sort('-createdAt').limit(5);
  
  const activeCollection = await MilkSale.findOne({ farmer: req.auth.id, status: 'in_progress' }).populate('vendor', 'fullName').lean();
  
  res.json({
    success: true,
    data: {
      totalEarningsThisMonth,
      totalMilkSoldThisMonth,
      recentTransactions,
      activeCollection
    }
  });
});

// Get Current Rate
r.get('/rate', async (req, res) => {
  let rateConfig = await SystemConfig.findOne({ key: 'CURRENT_MILK_RATE' });
  if (!rateConfig) {
    // Default rate if not set by admin
    rateConfig = await SystemConfig.create({ key: 'CURRENT_MILK_RATE', value: 34, description: 'Milk purchase rate per litre from farmers' });
  }
  res.json({ success: true, data: rateConfig.value });
});

// Sell Milk
r.post('/sell-milk', async (req, res) => {
  const { quantity, rateApplied, totalAmount, address } = req.body;
  if (!quantity || !rateApplied || !totalAmount) throw new ApiError(400, 'Missing required fields');
  
  const sale = await MilkSale.create({
    farmer: req.auth.id,
    quantity,
    rateApplied,
    totalAmount,
    status: 'initiated'
  });
  
  if (address) {
    const profile = await FarmerProfile.findOne({ user: req.auth.id });
    if (profile) {
      profile.address = { ...profile.address, ...address };
      await profile.save();
    }
  }
  
  res.json({ success: true, data: sale });
});

// Earnings History
r.get('/earnings', async (req, res) => {
  const sales = await MilkSale.find({ farmer: req.auth.id }).sort('-createdAt');
  res.json({ success: true, data: sales });
});

export default r;
