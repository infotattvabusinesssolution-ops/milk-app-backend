import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { Delivery } from '../models/Delivery.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/apiError.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { generateDeliveriesForPayment, generateRemainingDeliveries } from '../services/deliveryService.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const r=Router();r.use(requireAuth('customer'));

const razorpay = new Razorpay({
  key_id: 'rzp_test_TNGAVgWuOfX68B',
  key_secret: 'twkCiFi47zroT64w4240O3Ce'
});

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
    if (item.totalAmount) {
      totalAmount += item.totalAmount;
    } else {
      totalAmount += (item.price * item.quantity);
    }
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
      cycle: item.plan?.cycle || cycle,
      quantity: item.quantity,
      deliveryFrequency: item.deliveryFrequency || 'everyday',
      selectedDays: item.selectedDays || [],
      startDate: item.startDate ? new Date(item.startDate) : new Date(Date.now() + 86400000), // Start tomorrow by default
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      totalAmount: item.totalAmount,
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
    // Create Razorpay Order
      const options = {
        amount: Math.round(totalAmount * 100), // Razorpay works in paise and strictly requires integers
        currency: "INR",
        receipt: pay._id.toString()
      };
    
    try {
      const order = await razorpay.orders.create(options);
      return res.status(201).json({ 
        success: true, 
        data: { 
          payment: pay, 
          subscriptions: createdSubscriptions,
          razorpayOrderId: order.id,
          amount: options.amount
        } 
      });
    } catch (err) {
      console.error('Razorpay Error:', err);
      throw new ApiError(500, 'Failed to create payment order');
    }
  }

  res.status(201).json({ success: true, data: { payment: pay, subscriptions: createdSubscriptions } });
});

r.post('/payment/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;
  
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", 'twkCiFi47zroT64w4240O3Ce')
    .update(body.toString())
    .digest("hex");
    
  if (expectedSignature === razorpay_signature) {
    const pay = await Payment.findById(paymentId);
    if (!pay) throw new ApiError(404, 'Payment not found');
    
    pay.status = 'paid';
    await pay.save();
    
    // Activate subscriptions
    await Subscription.updateMany(
      { customer: req.auth.id, status: 'pending_payment' },
      { $set: { status: 'active' } }
    );
    
    // Generate deliveries
    await generateDeliveriesForPayment(pay._id, true);
    
    res.json({ success: true, message: 'Payment verified successfully' });
  } else {
    throw new ApiError(400, 'Invalid signature');
  }
});
r.get('/subscriptions',async(req,res)=>res.json({success:true,data:await Subscription.find({customer:req.auth.id, cycle: { $ne: 'onetime' }, status: { $ne: 'pending_payment' }}).populate('product').sort('-createdAt')}));
r.patch('/subscriptions/:id/pause', async (req, res) => {
  const { pauseFrom } = req.body;
  if (!pauseFrom) throw new ApiError(400, 'pauseFrom date is required');
  
  const pauseDate = new Date(pauseFrom);
  pauseDate.setHours(0,0,0,0);

  const sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!sub) throw new ApiError(404, 'Subscription not found');
  if (sub.status === 'paused') throw new ApiError(400, 'Already paused');

  // Delete future deliveries
  const deletedDeliveries = await Delivery.deleteMany({
    subscription: sub._id,
    deliveryDate: { $gte: pauseDate },
    status: { $in: ['scheduled', 'assigned'] }
  });

  sub.status = 'paused';
  sub.pauseFrom = pauseDate;
  sub.remainingDeliveries += deletedDeliveries.deletedCount || 0;
  await sub.save();

  res.json({ success: true, data: sub });
});

r.patch('/subscriptions/:id/resume', async (req, res) => {
  const { resumeDate } = req.body;
  const resumeD = resumeDate ? new Date(resumeDate) : new Date(Date.now() + 86400000);
  resumeD.setHours(0,0,0,0);

  const sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!sub) throw new ApiError(404, 'Subscription not found');
  if (sub.status !== 'paused') throw new ApiError(400, 'Not paused');

  if (sub.remainingDeliveries > 0) {
    await generateRemainingDeliveries(sub._id, resumeD, sub.remainingDeliveries);
  }

  sub.status = 'active';
  sub.pauseFrom = undefined;
  sub.pauseTo = undefined;
  sub.remainingDeliveries = 0;
  await sub.save();

  res.json({ success: true, data: sub });
});
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
