import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { Delivery } from '../models/Delivery.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/apiError.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { generateDeliveriesForPayment } from '../services/deliveryService.js';
const r=Router();r.use(requireAuth('customer'));
r.get('/me',async(req,res)=>res.json({success:true,data:await User.findById(req.auth.id)}));
r.patch('/me',async(req,res)=>res.json({success:true,data:await User.findByIdAndUpdate(req.auth.id,{$set:req.body},{new:true})}));
r.post('/addresses',async(req,res)=>{const u=await User.findById(req.auth.id);u.addresses.push(req.body);await u.save();res.status(201).json({success:true,data:u.addresses.at(-1)});});
r.put('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');a.set(req.body);await u.save();res.json({success:true,data:a});});
r.delete('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');u.addresses.pull(req.params.id);await u.save();res.json({success:true});});
r.get('/products',async(req,res)=>res.json({success:true,data:await Product.find({isActive:true})}));
r.post('/subscriptions',async(req,res)=>{const u=await User.findById(req.auth.id);if(!u.addresses.id(req.body.addressId))throw new ApiError(400,'Invalid address');const s=await Subscription.create({...req.body,customer:u._id});res.status(201).json({success:true,data:s});});

r.post('/checkout', async (req, res) => {
  const { items, addressId, paymentMethod } = req.body;
  if (!items || items.length === 0) throw new ApiError(400, 'Cart is empty');
  
  const u = await User.findById(req.auth.id);
  if (!u.addresses.id(addressId)) throw new ApiError(400, 'Invalid address');

  let totalAmount = 0;
  for (const item of items) {
    totalAmount += (item.price * item.quantity);
  }

  if (paymentMethod === 'wallet' && u.walletBalance < totalAmount) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  const createdSubscriptions = [];
  
  for (const item of items) {
    const isSub = item.purchaseType === 'subscription';
    const cycle = isSub ? (item.plan?.billingCycle || (item.plan?.frequency?.toLowerCase() === 'daily' ? 'daily' : 'weekly')) : 'onetime';

    const sub = await Subscription.create({
      customer: req.auth.id,
      product: item.product._id,
      addressId: addressId,
      cycle: cycle,
      quantity: item.quantity,
      deliveryFrequency: item.deliveryFrequency || 'everyday',
      selectedDays: item.selectedDays || [],
      startDate: new Date(Date.now() + 86400000), // Start tomorrow
      status: paymentMethod === 'cod' ? 'active' : 'pending_payment'
    });
    createdSubscriptions.push(sub);
  }

  const pay = await Payment.create({
    customer: req.auth.id,
    subscription: createdSubscriptions[0]._id, // Attach to first sub for reference
    amount: totalAmount,
    status: paymentMethod === 'cod' ? 'created' : 'created'
  });

  if (paymentMethod === 'wallet') {
    
    // Deduct balance
    await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -totalAmount } });
    
    // Create wallet transaction
    await WalletTransaction.create({
      customer: req.auth.id,
      amount: totalAmount,
      type: 'debit',
      description: 'Order Payment',
      referenceId: pay._id
    });
    
    pay.status = 'paid';
    await pay.save();
    
    // Generate full cycle of deliveries
    await generateDeliveriesForPayment(pay._id, true);
  } else if (paymentMethod === 'cod') {
    // Generate full cycle of deliveries for COD
    await generateDeliveriesForPayment(pay._id, true);
  } else if (paymentMethod === 'card') {
    // Mock card payment success
    pay.status = 'paid';
    await pay.save();
    await generateDeliveriesForPayment(pay._id, true);
  }

  res.status(201).json({ success: true, data: { payment: pay, subscriptions: createdSubscriptions } });
});
r.get('/subscriptions',async(req,res)=>res.json({success:true,data:await Subscription.find({customer:req.auth.id, cycle: { $ne: 'onetime' }, status: { $ne: 'pending_payment' }}).populate('product').sort('-createdAt')}));
r.patch('/subscriptions/:id/pause',async(req,res)=>res.json({success:true,data:await Subscription.findOneAndUpdate({_id:req.params.id,customer:req.auth.id},{$set:{status:'paused',pauseFrom:req.body.pauseFrom,pauseTo:req.body.pauseTo}},{new:true})}));
r.patch('/subscriptions/:id/resume',async(req,res)=>res.json({success:true,data:await Subscription.findOneAndUpdate({_id:req.params.id,customer:req.auth.id},{$set:{status:'active'},$unset:{pauseFrom:1,pauseTo:1}},{new:true})}));
r.patch('/subscriptions/:id/auto-renew',async(req,res)=>res.json({success:true,data:await Subscription.findOneAndUpdate({_id:req.params.id,customer:req.auth.id},{$set:{autoRenew:req.body.autoRenew}},{new:true})}));
r.post('/subscriptions/:id/renew', async(req,res) => {
  const sub = await Subscription.findOneAndUpdate({_id:req.params.id, customer:req.auth.id}, {$set: {status: 'active', startDate: new Date(Date.now() + 86400000)}}, {new: true});
  res.json({ success: true, data: sub });
});

r.delete('/subscriptions/:id', async (req, res) => {
  const sub = await Subscription.findOneAndDelete({_id: req.params.id, customer: req.auth.id});
  if(!sub) throw new ApiError(404, 'Subscription not found');
  await Delivery.deleteMany({ subscription: sub._id, status: { $in: ['scheduled', 'pending', 'rescheduled'] }});
  res.json({success:true});
});

r.get('/deliveries',async(req,res)=>res.json({success:true,data:await Delivery.find({customer:req.auth.id}).populate('product').populate('partner','name phone').sort('deliveryDate')}));


r.get('/orders',async(req,res)=>res.json({success:true,data:await Delivery.find({customer:req.auth.id}).populate('product').populate('partner','name phone').populate('subscription', 'cycle').sort('-createdAt')}));
r.get('/payments',async(req,res)=>res.json({success:true,data:await Payment.find({customer:req.auth.id}).sort('-createdAt')}));

// Wallet endpoints
r.get('/wallet/transactions', async (req, res) => {
  const transactions = await WalletTransaction.find({ customer: req.auth.id }).sort('-createdAt');
  res.json({ success: true, data: transactions });
});

r.post('/wallet/topup', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Invalid amount');
  
  // Create transaction
  const transaction = await WalletTransaction.create({
    customer: req.auth.id,
    amount,
    type: 'credit',
    description: 'Wallet Top-up'
  });
  
  // Update balance
  const user = await User.findByIdAndUpdate(
    req.auth.id,
    { $inc: { walletBalance: amount } },
    { new: true }
  );
  
  res.json({ success: true, data: { balance: user.walletBalance, transaction } });
});

export default r;
