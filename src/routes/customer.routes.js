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

r.get('/me', async (req, res) => {
  const user = await User.findById(req.auth.id).lean();
  const activeSub = await Subscription.findOne({ customer: req.auth.id, status: 'active', cycle: { $ne: 'onetime' } });
  res.json({ success: true, data: { ...user, hasActiveSubscription: !!activeSub, activeSubscriptionId: activeSub?._id } });
});

r.patch('/me',async(req,res)=>res.json({success:true,data:await User.findByIdAndUpdate(req.auth.id,{$set:req.body},{new:true})}));
r.post('/addresses',async(req,res)=>{const u=await User.findById(req.auth.id);u.addresses.push(req.body);await u.save();res.status(201).json({success:true,data:u.addresses.at(-1)});});
r.put('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');a.set(req.body);await u.save();res.json({success:true,data:a});});
r.delete('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');u.addresses.pull(req.params.id);await u.save();res.json({success:true});});
r.get('/products',async(req,res)=>res.json({success:true,data:await Product.find({isActive:true})}));
r.post('/subscriptions',async(req,res)=>{const u=await User.findById(req.auth.id);if(!u.addresses.id(req.body.addressId))throw new ApiError(400,'Invalid address');const s=await Subscription.create({...req.body,customer:u._id});res.status(201).json({success:true,data:s});});

r.post('/checkout', async (req, res) => {
  let { items, addressId, paymentMethod, useWallet, isCartCheckout } = req.body;
  
  if (isCartCheckout) {
    // Forcefully remove any stale subscription items that might be stuck in the user's cart
    items = items.filter(item => item.purchaseType !== 'subscription');
  }

  if (!items || items.length === 0) throw new ApiError(400, 'Cart is empty');
  
  // Enforce single active subscription check
  const hasSubscriptionInCart = items.some(item => item.purchaseType === 'subscription');
  if (hasSubscriptionInCart) {
    const activeSub = await Subscription.findOne({ 
      customer: req.auth.id, 
      status: 'active',
      cycle: { $ne: 'onetime' }
    });
    if (activeSub) {
      throw new ApiError(400, "You already have an active subscription. Please order extra milk for specific dates from your dashboard.");
    }
  }

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

  let walletDeduction = 0;
  if (useWallet) {
    walletDeduction = Math.min(u.walletBalance, totalAmount);
  } else if (paymentMethod === 'wallet') {
    if (u.walletBalance < totalAmount) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }
    walletDeduction = totalAmount;
  }
  
  const payableAmount = totalAmount - walletDeduction;

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
      startDate: item.startDate ? new Date(item.startDate) : new Date(Date.now() + 86400000),
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      totalAmount: item.totalAmount,
      status: paymentMethod === 'cod' && payableAmount > 0 ? 'active' : 'pending_payment'
    });
    createdSubscriptions.push(sub);
  }

  const pay = await Payment.create({
    customer: req.auth.id,
    subscription: createdSubscriptions[0]._id,
    amount: totalAmount,
    status: 'created',
    metadata: { walletDeducted: walletDeduction, type: 'checkout' }
  });

  if (payableAmount === 0 || paymentMethod === 'wallet') {
    if (walletDeduction > 0) {
      await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -walletDeduction } });
      await WalletTransaction.create({
        customer: req.auth.id, amount: walletDeduction, type: 'debit', description: 'Order Payment', referenceId: pay._id
      });
    }
    
    pay.status = 'paid';
    await pay.save();
    
    await Subscription.updateMany(
      { customer: req.auth.id, _id: { $in: createdSubscriptions.map(s => s._id) } },
      { $set: { status: 'active' } }
    );
    await generateDeliveriesForPayment(pay._id, true);
    return res.status(201).json({ success: true, data: { payment: pay, subscriptions: createdSubscriptions } });
  } else if (paymentMethod === 'cod') {
    if (walletDeduction > 0) {
      await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -walletDeduction } });
      await WalletTransaction.create({
        customer: req.auth.id, amount: walletDeduction, type: 'debit', description: 'Partial Order Payment', referenceId: pay._id
      });
    }
    await Subscription.updateMany(
      { customer: req.auth.id, _id: { $in: createdSubscriptions.map(s => s._id) } },
      { $set: { status: 'active' } }
    );
    await generateDeliveriesForPayment(pay._id, true);
    return res.status(201).json({ success: true, data: { payment: pay, subscriptions: createdSubscriptions } });
  } else if (paymentMethod === 'card') {
    const options = {
      amount: Math.round(payableAmount * 100),
      currency: "INR",
      receipt: pay._id.toString()
    };
    try {
      const order = await razorpay.orders.create(options);
      return res.status(201).json({ 
        success: true, 
        data: { payment: pay, subscriptions: createdSubscriptions, razorpayOrderId: order.id, amount: options.amount } 
      });
    } catch (err) {
      console.error('Razorpay Error:', err);
      throw new ApiError(500, 'Failed to create payment order');
    }
  }
});

// EXTRA MILK ENDPOINT
r.post('/subscriptions/:id/extra-milk', async (req, res) => {
  const { date, productId, quantity, paymentMethod, useWallet } = req.body;
  
  if (!date || !productId || !quantity || !paymentMethod) {
    throw new ApiError(400, 'Missing required fields (date, productId, quantity, paymentMethod)');
  }
  
  const targetDate = new Date(date);
  targetDate.setHours(0,0,0,0);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  if (targetDate <= today) {
    throw new ApiError(400, 'Extra milk can only be ordered for future dates.');
  }

  const sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id, status: 'active' });
  if (!sub) throw new ApiError(404, 'Active subscription not found.');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');
  
  const totalAmount = product.price * quantity;
  
  const u = await User.findById(req.auth.id);
  let walletDeduction = 0;
  
  if (useWallet) {
    walletDeduction = Math.min(u.walletBalance, totalAmount);
  } else if (paymentMethod === 'wallet') {
    if (u.walletBalance < totalAmount) throw new ApiError(400, 'Insufficient wallet balance');
    walletDeduction = totalAmount;
  }
  
  const payableAmount = totalAmount - walletDeduction;

  const pay = await Payment.create({
    customer: req.auth.id,
    subscription: sub._id,
    amount: totalAmount,
    status: 'created',
    metadata: { walletDeducted: walletDeduction, type: 'extra_milk', productId, quantity, date: targetDate.toISOString() }
  });

  if (payableAmount === 0 || paymentMethod === 'wallet') {
    if (walletDeduction > 0) {
      await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -walletDeduction } });
      await WalletTransaction.create({
        customer: req.auth.id, amount: walletDeduction, type: 'debit', description: 'Extra Milk Payment', referenceId: pay._id
      });
    }
    pay.status = 'paid';
    await pay.save();
    
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity,
      payment: pay._id,
      status: 'scheduled',
      isExtra: true
    });
    
    return res.status(201).json({ success: true, data: { payment: pay, delivery } });
  } else if (paymentMethod === 'cod') {
    // Currently the UI says "Pay ?112 & Confirm", typically COD might not be allowed for extras, but we'll support it
    if (walletDeduction > 0) {
      await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -walletDeduction } });
      await WalletTransaction.create({
        customer: req.auth.id, amount: walletDeduction, type: 'debit', description: 'Partial Extra Milk Payment', referenceId: pay._id
      });
    }
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity,
      payment: pay._id,
      status: 'scheduled',
      isExtra: true
    });
    return res.status(201).json({ success: true, data: { payment: pay, delivery } });
  } else if (paymentMethod === 'card') {
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity,
      payment: pay._id,
      status: 'pending_payment',
      isExtra: true
    });

    const options = {
      amount: Math.round(payableAmount * 100),
      currency: "INR",
      receipt: pay._id.toString()
    };
    try {
      const order = await razorpay.orders.create(options);
      return res.status(201).json({ 
        success: true, 
        data: { payment: pay, delivery, razorpayOrderId: order.id, amount: options.amount } 
      });
    } catch (err) {
      console.error('Razorpay Error:', err);
      throw new ApiError(500, 'Failed to create payment order');
    }
  }
});


r.post('/payment/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;
  
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto.createHmac("sha256", 'twkCiFi47zroT64w4240O3Ce').update(body.toString()).digest("hex");
    
  if (expectedSignature === razorpay_signature) {
    const pay = await Payment.findById(paymentId);
    if (!pay) throw new ApiError(404, 'Payment not found');
    
    pay.status = 'paid';
    await pay.save();

    if (pay.metadata && pay.metadata.walletDeducted > 0) {
      const deduction = pay.metadata.walletDeducted;
      await User.findByIdAndUpdate(req.auth.id, { $inc: { walletBalance: -deduction } });
      await WalletTransaction.create({
        customer: req.auth.id, amount: deduction, type: 'debit', description: 'Partial Payment', referenceId: pay._id
      });
    }
    
    if (pay.metadata?.type === 'extra_milk') {
      // It's an extra milk delivery payment
      await Delivery.updateMany(
        { payment: pay._id, status: 'pending_payment', isExtra: true },
        { $set: { status: 'scheduled' } }
      );
    } else {
      // It's a regular checkout payment
      await Subscription.updateMany(
        { customer: req.auth.id, status: 'pending_payment' },
        { $set: { status: 'active' } }
      );
      await generateDeliveriesForPayment(pay._id, true);
    }
    
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

  const sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id, status: 'active' });
  if (!sub) throw new ApiError(400, 'Subscription not found or already paused');

  const updateRes = await Subscription.updateOne(
    { _id: sub._id, status: 'active' },
    { $set: { status: 'paused', pauseFrom: pauseDate } }
  );
  if (updateRes.modifiedCount === 0) throw new ApiError(400, 'Subscription was already paused');

  const deletedDeliveries = await Delivery.deleteMany({
    subscription: sub._id,
    deliveryDate: { $gte: pauseDate },
    status: { $in: ['scheduled', 'assigned'] }
  });

  await Subscription.updateOne(
    { _id: sub._id },
    { $inc: { remainingDeliveries: deletedDeliveries.deletedCount || 0 } }
  );

  res.json({ success: true });
});

r.patch('/subscriptions/:id/resume', async (req, res) => {
  const { resumeDate } = req.body;
  const resumeD = resumeDate ? new Date(resumeDate) : new Date(Date.now() + 86400000);
  resumeD.setHours(0,0,0,0);

  const sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id, status: 'paused' });
  if (!sub) throw new ApiError(400, 'Subscription not found or not paused');

  const remaining = sub.remainingDeliveries;
  
  const updateRes = await Subscription.updateOne(
    { _id: sub._id, status: 'paused' },
    { $set: { status: 'active', pauseFrom: undefined, pauseTo: undefined, remainingDeliveries: 0 } }
  );
  if (updateRes.modifiedCount === 0) throw new ApiError(400, 'Subscription was already resumed');

  if (remaining > 0) {
    await generateRemainingDeliveries(sub._id, resumeD, remaining);
  }

  res.json({ success: true });
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

r.get('/wallet/transactions', async (req, res) => {
  const transactions = await WalletTransaction.find({ customer: req.auth.id }).sort('-createdAt');
  res.json({ success: true, data: transactions });
});

r.post('/wallet/topup/order', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Invalid amount');
  
  const options = {
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `wt_${req.auth.id.toString().slice(-6)}_${Date.now()}`
  };
  
  try {
    const order = await razorpay.orders.create(options);
    res.json({ success: true, data: { orderId: order.id, amount: options.amount } });
  } catch (err) {
    console.error('Razorpay Error:', err);
    throw new ApiError(500, 'Failed to create top-up order');
  }
});

r.post('/wallet/topup/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
  
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto.createHmac("sha256", 'twkCiFi47zroT64w4240O3Ce').update(body.toString()).digest("hex");
  
  if (expectedSignature === razorpay_signature) {
    const user = await User.findByIdAndUpdate(
      req.auth.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    const transaction = await WalletTransaction.create({
      customer: req.auth.id,
      amount,
      type: 'credit',
      description: 'Wallet Top-up via Razorpay',
      referenceId: razorpay_payment_id
    });
    res.json({ success: true, data: { balance: user.walletBalance, transaction } });
  } else {
    throw new ApiError(400, 'Invalid signature');
  }
});

export default r;
