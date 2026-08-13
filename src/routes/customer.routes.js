import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { Delivery } from '../models/Delivery.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/apiError.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { generateDeliveriesForPayment, generateRemainingDeliveries } from '../services/deliveryService.js';
import { calculateDeliveryCharge } from '../utils/delivery.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const r=Router();r.use(requireAuth('customer'));

const razorpay = new Razorpay({
  key_id: 'rzp_test_TNGAVgWuOfX68B',
  key_secret: 'twkCiFi47zroT64w4240O3Ce'
});

const roundMoney = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

const debitWallet = async ({ customerId, amount, paymentId, description }) => {
  const debitAmount = roundMoney(amount);
  if (debitAmount <= 0) return null;

  const updatedUser = await User.findOneAndUpdate(
    { _id: customerId, walletBalance: { $gte: debitAmount } },
    { $inc: { walletBalance: -debitAmount } },
    { new: true }
  );

  if (!updatedUser) {
    throw new ApiError(409, 'Wallet balance changed. Please review your balance and try again.');
  }

  try {
    await WalletTransaction.create({
      customer: customerId,
      amount: debitAmount,
      type: 'debit',
      description,
      referenceId: paymentId
    });
  } catch (error) {
    await User.findByIdAndUpdate(customerId, { $inc: { walletBalance: debitAmount } });
    throw error;
  }

  return updatedUser;
};

const resolveCustomerAddress = async (user, addressId, addressBody) => {
  if (!user) return null;

  // 1. Check if addressId is a valid ObjectId and exists in user.addresses
  if (addressId && mongoose.Types.ObjectId.isValid(addressId) && user.addresses?.id && user.addresses.id(addressId)) {
    return addressId;
  }

  // 2. Check if addressBody contains a valid ObjectId _id or id
  if (addressBody && typeof addressBody === 'object') {
    const rawId = addressBody._id || addressBody.id || addressBody.addressId;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId) && user.addresses?.id && user.addresses.id(rawId)) {
      return rawId;
    }

    // 3. Try matching existing address by building/area
    const buildingStr = (addressBody.building || addressBody.address || '').toString().trim();
    const areaStr = (addressBody.area || '').toString().trim();
    if (user.addresses && user.addresses.length > 0) {
      const match = user.addresses.find(a => 
        (buildingStr && a.building && a.building.trim().toLowerCase() === buildingStr.toLowerCase()) ||
        (areaStr && a.area && a.area.trim().toLowerCase() === areaStr.toLowerCase())
      );
      if (match) return match._id;
    }

    // 4. Auto-save addressBody to user's addresses subdocuments
    const newAddr = {
      name: (addressBody.name || user.name || 'Delivery Address').toString(),
      phone: (addressBody.phone || user.phone || '').toString(),
      building: buildingStr || 'Delivery Location',
      area: areaStr,
      landmark: (addressBody.landmark || '').toString(),
      city: (addressBody.city || 'Kanpur').toString(),
      state: (addressBody.state || 'Uttar Pradesh').toString(),
      pincode: (addressBody.pincode || '208001').toString(),
      label: (addressBody.label || 'Home Address').toString(),
      isDefault: !user.addresses || user.addresses.length === 0
    };
    user.addresses = user.addresses || [];
    user.addresses.push(newAddr);
    await user.save();
    return user.addresses.at(-1)._id;
  }

  // 5. Fallback to user's first address if available
  if (user.addresses && user.addresses.length > 0) {
    return user.addresses[0]._id;
  }

  return null;
};

r.get('/me', async (req, res) => {
  const user = await User.findById(req.auth.id).lean();
  const activeSub = await Subscription.findOne({ customer: req.auth.id, status: 'active', cycle: { $ne: 'onetime' } });
  res.json({ success: true, data: { ...user, hasActiveSubscription: !!activeSub, activeSubscriptionId: activeSub?._id } });
});

r.patch('/me',async(req,res)=>res.json({success:true,data:await User.findByIdAndUpdate(req.auth.id,{$set:req.body},{new:true})}));
r.get('/addresses',async(req,res)=>{const u=await User.findById(req.auth.id).lean();res.json({success:true,data:u.addresses||[]});});
r.post('/addresses',async(req,res)=>{const u=await User.findById(req.auth.id);u.addresses.push(req.body);await u.save();res.status(201).json({success:true,data:u.addresses.at(-1)});});
r.put('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');a.set(req.body);await u.save();res.json({success:true,data:a});});
r.delete('/addresses/:id',async(req,res)=>{const u=await User.findById(req.auth.id);const a=u.addresses.id(req.params.id);if(!a)throw new ApiError(404,'Address not found');u.addresses.pull(req.params.id);await u.save();res.json({success:true});});
r.get('/products',async(req,res)=>res.json({success:true,data:await Product.find({isActive:true})}));
r.post('/subscriptions', async (req, res) => {
  const u = await User.findById(req.auth.id);
  const resolvedAddrId = await resolveCustomerAddress(u, req.body.addressId, req.body.address);
  if (!resolvedAddrId) throw new ApiError(400, 'Invalid address. Please provide or select a valid delivery address.');
  req.body.addressId = resolvedAddrId;

  let resolvedProdId = req.body.product?._id || req.body.product || req.body.productId;
  if (!resolvedProdId || !mongoose.Types.ObjectId.isValid(resolvedProdId)) {
    const dbProd = await Product.findOne({ isActive: true }) || await Product.findOne() || await Product.create({ name: 'Shudh Desi Cow Milk', price: 90, isActive: true });
    resolvedProdId = dbProd._id;
  }

  const s = await Subscription.create({
    ...req.body,
    product: resolvedProdId,
    customer: u._id
  });
  res.status(201).json({ success: true, data: s });
});

r.post('/checkout/calculate', async (req, res) => {
  let { items, addressId, addressLat, addressLng, useWallet } = req.body;
  useWallet = useWallet === true;

  if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });
  
  const u = await User.findById(req.auth.id);
  let customerAddress = null;
  if (addressId && addressId !== 'new' && u.addresses.id(addressId)) {
    customerAddress = u.addresses.id(addressId);
  } else if (addressLat !== undefined && addressLng !== undefined) {
    customerAddress = { lat: Number(addressLat), lng: Number(addressLng) };
  }

  let itemTotal = 0;
  for (const item of items) {
    if (!item) continue;
    const presetPlanId = item.plan?._id;
    if (presetPlanId) {
      const storedPlan = await SubscriptionPlan.findOne({ _id: presetPlanId, isActive: true }).lean();
      if (storedPlan) {
        itemTotal += Number(storedPlan.finalPayableAmount) || 0;
      }
    } else if (item.product?._id) {
      const qty = Number(item.quantity) || 1;
      const tAmt = item.totalAmount !== undefined && item.totalAmount !== null ? Number(item.totalAmount) : Number(item.price) * qty;
      itemTotal += tAmt || 0;
    }
  }

  itemTotal = roundMoney(itemTotal);

  let deliveryInfo = { charge: 0, distanceKm: 0 };
  if (customerAddress) {
    deliveryInfo = await calculateDeliveryCharge(customerAddress);
  }

  const totalBeforeWallet = roundMoney(itemTotal + deliveryInfo.charge);
  let walletDeduction = 0;
  if (useWallet) {
    walletDeduction = Math.min(Math.max(0, u.walletBalance), totalBeforeWallet);
  }

  const finalPayableAmount = roundMoney(totalBeforeWallet - walletDeduction);

  res.json({
    success: true,
    data: {
      itemTotal,
      deliveryCharge: deliveryInfo.charge,
      distanceKm: deliveryInfo.distanceKm,
      walletDeduction,
      finalPayableAmount
    }
  });
});

r.post('/checkout', async (req, res) => {
  let { items, addressId, paymentMethod, useWallet, isCartCheckout } = req.body;
  useWallet = useWallet === true;

  if (!['wallet', 'cod', 'card'].includes(paymentMethod)) {
    throw new ApiError(400, 'Invalid payment method');
  }
  
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
  const resolvedAddrId = await resolveCustomerAddress(u, addressId, req.body.address || req.body.selectedAddress);
  if (!resolvedAddrId) throw new ApiError(400, 'Invalid address');
  addressId = resolvedAddrId;

  let totalAmount = 0;
  const validatedItems = [];

  for (const item of items) {
    if (!item) throw new ApiError(400, 'Invalid checkout item');

    let validatedItem = { ...item };
    const presetPlanId = item.plan?._id;

    if (presetPlanId) {
      if (!mongoose.isValidObjectId(presetPlanId)) throw new ApiError(400, 'Invalid subscription plan');
      const storedPlan = await SubscriptionPlan.findOne({ _id: presetPlanId, isActive: true }).lean();
      if (!storedPlan) throw new ApiError(400, 'Subscription plan is unavailable');

      const storedTotal = Number(storedPlan.finalPayableAmount);
      if (!Number.isFinite(storedTotal) || storedTotal <= 0) {
        throw new ApiError(400, 'Subscription plan has invalid pricing');
      }

      const totalDeliveries = Math.max(1, Number(storedPlan.totalDeliveries) || 1);
      validatedItem = {
        ...item,
        product: { _id: storedPlan.product },
        quantity: Math.max(1, Number(storedPlan.quantityPerDelivery) || 1),
        price: roundMoney(storedTotal / totalDeliveries),
        totalAmount: roundMoney(storedTotal),
        deliveryFrequency: storedPlan.frequency === 'Selected Weekdays' ? 'selected_days' : 'everyday',
        selectedDays: storedPlan.frequency === 'Selected Weekdays' ? (storedPlan.selectedWeekdays || []) : [],
        plan: {
          ...item.plan,
          billingCycle: storedPlan.billingCycle,
          cycle: storedPlan.billingCycle,
          frequency: storedPlan.frequency,
          durationDays: storedPlan.durationDays,
          totalDeliveries
        }
      };
    } else {
      let pId = item.product?._id || item.productId || item.id || item._id;
      if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
        const dbProd = await Product.findOne({
          $or: [
            { name: new RegExp(item.name || item.milkType || 'Cow', 'i') },
            { isActive: true }
          ]
        }) || await Product.findOne();
        if (dbProd) pId = dbProd._id;
      }
      if (!pId) throw new ApiError(400, 'Checkout product is invalid');
      item.product = { _id: pId };

      const quantity = Math.max(1, Number(item.quantity) || 1);
      const priceVal = Number(item.price ?? item.pricePerLitre ?? item.product?.price ?? item.itemTotal ?? item.totalAmount ?? 90);
      const itemTotal = (item.totalAmount !== undefined && item.totalAmount !== null)
        ? Number(item.totalAmount)
        : (item.itemTotal !== undefined && item.itemTotal !== null)
          ? Number(item.itemTotal)
          : priceVal * quantity;

      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(itemTotal) || itemTotal <= 0) {
        throw new ApiError(400, 'Checkout item has invalid quantity or pricing');
      }

      validatedItem.product = item.product;
      validatedItem.quantity = quantity;
      validatedItem.price = priceVal;
      validatedItem.totalAmount = roundMoney(itemTotal);
    }

    totalAmount += validatedItem.totalAmount;
    validatedItems.push(validatedItem);
  }

  items = validatedItems;

  let deliveryInfo = { charge: 0, distanceKm: 0 };
  if (addressId && u.addresses.id(addressId)) {
    deliveryInfo = await calculateDeliveryCharge(u.addresses.id(addressId));
  }
  
  totalAmount = roundMoney(totalAmount + deliveryInfo.charge);

  let walletDeduction = 0;
  if (useWallet) {
    walletDeduction = Math.min(Math.max(0, u.walletBalance), totalAmount);
  } else if (paymentMethod === 'wallet') {
    if (u.walletBalance < totalAmount) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }
    walletDeduction = totalAmount;
  }
  
  totalAmount = roundMoney(totalAmount);
  walletDeduction = roundMoney(walletDeduction);
  const payableAmount = roundMoney(totalAmount - walletDeduction);

  const createdSubscriptions = [];
  
  for (const item of items) {
    const reqFreq = (item.deliveryFrequency || req.body.deliveryFrequency || item.plan?.frequency || '').toString().toLowerCase();

    let finalCycle = 'onetime';
    if (reqFreq.includes('month')) {
      finalCycle = 'monthly';
    } else if (reqFreq.includes('week')) {
      finalCycle = 'weekly';
    } else if (reqFreq.includes('daily') || reqFreq.includes('everyday')) {
      finalCycle = 'daily';
    } else if (item.plan?.cycle || item.plan?.billingCycle) {
      finalCycle = (item.plan?.cycle || item.plan?.billingCycle).toLowerCase();
      if (finalCycle.includes('single day') || finalCycle === 'onetime') {
        finalCycle = 'onetime';
      }
    } else if (item.purchaseType === 'subscription') {
      finalCycle = 'weekly';
    }

    const rawStartDate = item.startDate || item.plan?.startDate;
    const normalizedStartDate = rawStartDate ? new Date(rawStartDate) : new Date(Date.now() + 86400000);
    if (Number.isNaN(normalizedStartDate.getTime())) {
      throw new ApiError(400, 'Subscription start date is invalid');
    }

    const rawEndDate = item.endDate || item.plan?.endDate;
    let normalizedEndDate = rawEndDate ? new Date(rawEndDate) : undefined;
    if (!normalizedEndDate && item.plan?._id) {
      normalizedEndDate = new Date(normalizedStartDate);
      const durationDays = Math.max(1, Number(item.plan.durationDays) || Number(item.plan.totalDeliveries) || 1);
      normalizedEndDate.setDate(normalizedEndDate.getDate() + durationDays - 1);
    }
    if (normalizedEndDate && Number.isNaN(normalizedEndDate.getTime())) {
      throw new ApiError(400, 'Subscription end date is invalid');
    }
    if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
      throw new ApiError(400, 'Subscription end date must be after the start date');
    }

    let resolvedProdId = item.product?._id || item.product || item.productId;
    if (!resolvedProdId || !mongoose.Types.ObjectId.isValid(resolvedProdId)) {
      const dbProd = await Product.findOne({ isActive: true }) || await Product.findOne() || await Product.create({ name: 'Shudh Desi Cow Milk', price: 90, isActive: true });
      resolvedProdId = dbProd._id;
    }

    const subDeliveryFreq = (item.deliveryFrequency === 'selected_days' || (item.selectedDays && item.selectedDays.length > 0))
      ? 'selected_days'
      : 'everyday';

    const sub = await Subscription.create({
      customer: req.auth.id,
      product: resolvedProdId,
      addressId: addressId,
      cycle: finalCycle,
      quantity: item.quantity,
      deliveryFrequency: subDeliveryFreq,
      selectedDays: item.selectedDays || [],
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
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
    metadata: {
      walletDeducted: walletDeduction,
      walletDebited: false,
      payableAmount,
      paymentMethod,
      deliveryCharge: deliveryInfo.charge,
      distanceKm: deliveryInfo.distanceKm,
      type: 'checkout'
    }
  });

  if (payableAmount === 0 || paymentMethod === 'wallet') {
    let updatedUser = null;
    if (walletDeduction > 0) {
      updatedUser = await debitWallet({
        customerId: req.auth.id,
        amount: walletDeduction,
        paymentId: pay._id,
        description: 'Milk Wallet applied to subscription'
      });
      pay.set('metadata', { ...pay.metadata, walletDebited: true });
    }
    
    pay.status = 'paid';
    await pay.save();
    
    await Subscription.updateMany(
      { customer: req.auth.id, _id: { $in: createdSubscriptions.map(s => s._id) } },
      { $set: { status: 'active' } }
    );
    await generateDeliveriesForPayment(pay._id, true);
    return res.status(201).json({
      success: true,
      data: {
        payment: pay,
        subscriptions: createdSubscriptions,
        totalAmount,
        walletDeduction,
        payableAmount,
        walletBalance: updatedUser?.walletBalance ?? u.walletBalance
      }
    });
  } else if (paymentMethod === 'cod') {
    let updatedUser = null;
    if (walletDeduction > 0) {
      updatedUser = await debitWallet({
        customerId: req.auth.id,
        amount: walletDeduction,
        paymentId: pay._id,
        description: 'Milk Wallet discount on COD subscription'
      });
      pay.set('metadata', { ...pay.metadata, walletDebited: true });
      await pay.save();
    }
    await Subscription.updateMany(
      { customer: req.auth.id, _id: { $in: createdSubscriptions.map(s => s._id) } },
      { $set: { status: 'active' } }
    );
    await generateDeliveriesForPayment(pay._id, true);
    return res.status(201).json({
      success: true,
      data: {
        payment: pay,
        subscriptions: createdSubscriptions,
        totalAmount,
        walletDeduction,
        payableAmount,
        walletBalance: updatedUser?.walletBalance ?? u.walletBalance
      }
    });
  } else if (paymentMethod === 'card') {
    const options = {
      amount: Math.round(payableAmount * 100),
      currency: "INR",
      receipt: pay._id.toString()
    };
    try {
      const order = await razorpay.orders.create(options);
      pay.providerOrderId = order.id;
      await pay.save();
      return res.status(201).json({ 
        success: true, 
        data: {
          payment: pay,
          subscriptions: createdSubscriptions,
          razorpayOrderId: order.id,
          amount: options.amount,
          totalAmount,
          walletDeduction,
          payableAmount
        }
      });
    } catch (err) {
      console.error('Razorpay Error:', err);
      throw new ApiError(500, 'Failed to create payment order');
    }
  }
});

// EXTRA MILK ENDPOINT
r.post('/subscriptions/:id/extra-milk', async (req, res) => {
  let { date, productId, quantity, paymentMethod, useWallet } = req.body;
  const requestedQuantity = Number(quantity);
  
  if (paymentMethod === 'razorpay') paymentMethod = 'card';
  
  if (!date || !productId || !paymentMethod || !Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new ApiError(400, 'Missing required fields (date, productId, quantity, paymentMethod)');
  }
  if (!['wallet', 'cod', 'card'].includes(paymentMethod)) throw new ApiError(400, 'Invalid payment method');
  
  const targetDate = new Date(date);
  if (Number.isNaN(targetDate.getTime())) throw new ApiError(400, 'Invalid delivery date');
  targetDate.setHours(0,0,0,0);

  let product;
  if (mongoose.Types.ObjectId.isValid(productId)) {
    product = await Product.findById(productId);
  }
  if (!product) {
    product = await Product.findOne({ isActive: true, $or: [{ name: new RegExp(productId, 'i') }, { name: /cow/i }] });
  }
  if (!product) {
    product = await Product.findOne({ isActive: true });
  }
  if (!product) {
    product = await Product.create({
      name: 'Shudh Desi Cow Milk',
      price: 90,
      pricePerUnit: 90,
      isActive: true
    });
  }

  const u = await User.findById(req.auth.id);
  const resolvedAddrId = req.body.addressId || req.body.address?.id || req.body.address?._id || u.addresses?.[0]?._id;

  let sub;
  if (req.params.id && req.params.id !== 'active' && mongoose.Types.ObjectId.isValid(req.params.id)) {
    sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id, status: 'active' });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id });
  }
  if (!sub) {
    sub = await Subscription.create({
      customer: req.auth.id,
      product: product._id,
      addressId: resolvedAddrId,
      status: 'active',
      cycle: 'daily',
      quantity: requestedQuantity,
      startDate: new Date()
    });
  }

  const primaryVariant = product.variants?.[0];
  const variantPrice = primaryVariant?.salePrice > 0 ? primaryVariant.salePrice : primaryVariant?.regularPrice;
  const unitPrice = Number(variantPrice ?? product.pricePerUnit ?? 90);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new ApiError(400, 'This product does not have a valid price');
  }

  const totalAmount = roundMoney(unitPrice * requestedQuantity);
  let walletDeduction = 0;
  
  if (useWallet === true) {
    walletDeduction = Math.min(Math.max(0, u.walletBalance), totalAmount);
  } else if (paymentMethod === 'wallet') {
    if (u.walletBalance < totalAmount) throw new ApiError(400, 'Insufficient wallet balance');
    walletDeduction = totalAmount;
  }
  
  walletDeduction = roundMoney(walletDeduction);
  const payableAmount = roundMoney(totalAmount - walletDeduction);

  const pay = await Payment.create({
    customer: req.auth.id,
    subscription: sub._id,
    amount: totalAmount,
    status: 'created',
    metadata: {
      walletDeducted: walletDeduction,
      walletDebited: false,
      payableAmount,
      unitPrice,
      type: 'extra_milk',
      productId,
      quantity: requestedQuantity,
      date: targetDate.toISOString()
    }
  });

  if (payableAmount === 0 || paymentMethod === 'wallet') {
    if (walletDeduction > 0) {
      await debitWallet({
        customerId: req.auth.id,
        amount: walletDeduction,
        paymentId: pay._id,
        description: 'Extra milk payment from Milk Wallet'
      });
      pay.set('metadata', { ...pay.metadata, walletDebited: true });
    }
    pay.status = 'paid';
    await pay.save();
    
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity: requestedQuantity,
      payment: pay._id,
      status: 'scheduled',
      isExtra: true
    });
    
    return res.status(201).json({ success: true, data: { payment: pay, delivery, totalAmount, walletDeduction, payableAmount } });
  } else if (paymentMethod === 'cod') {
    if (walletDeduction > 0) {
      await debitWallet({
        customerId: req.auth.id,
        amount: walletDeduction,
        paymentId: pay._id,
        description: 'Milk Wallet discount on extra milk'
      });
      pay.set('metadata', { ...pay.metadata, walletDebited: true });
      await pay.save();
    }
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity: requestedQuantity,
      payment: pay._id,
      status: 'scheduled',
      isExtra: true
    });
    return res.status(201).json({ success: true, data: { payment: pay, delivery, totalAmount, walletDeduction, payableAmount } });
  } else if (paymentMethod === 'card') {
    const delivery = await Delivery.create({
      customer: req.auth.id,
      subscription: sub._id,
      product: productId,
      deliveryDate: targetDate,
      quantity: requestedQuantity,
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
      pay.providerOrderId = order.id;
      await pay.save();
      return res.status(201).json({ 
        success: true, 
        data: { payment: pay, delivery, razorpayOrderId: order.id, amount: options.amount, totalAmount, walletDeduction, payableAmount } 
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
    const pay = await Payment.findOne({ _id: paymentId, customer: req.auth.id });
    if (!pay) throw new ApiError(404, 'Payment not found');

    if (pay.status === 'paid') {
      return res.json({ success: true, message: 'Payment already verified' });
    }

    if (pay.providerOrderId && pay.providerOrderId !== razorpay_order_id) {
      throw new ApiError(400, 'Payment order does not match');
    }

    if (pay.metadata?.walletDeducted > 0 && !pay.metadata?.walletDebited) {
      await debitWallet({
        customerId: req.auth.id,
        amount: pay.metadata.walletDeducted,
        paymentId: pay._id,
        description: pay.metadata?.type === 'extra_milk'
          ? 'Milk Wallet discount on extra milk'
          : 'Milk Wallet discount on subscription'
      });
      pay.set('metadata', { ...pay.metadata, walletDebited: true });
    }
    
    pay.status = 'paid';
    pay.providerOrderId = razorpay_order_id;
    pay.providerPaymentId = razorpay_payment_id;
    pay.paidAt = new Date();
    await pay.save();
    
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
r.get('/all-orders',async(req,res)=>res.json({success:true,data:await Subscription.find({customer:req.auth.id, status: { $ne: 'pending_payment' }}).populate('product').sort('-createdAt')}));
r.patch('/subscriptions/:id/pause', async (req, res) => {
  const { pauseFrom } = req.body;
  const pauseDate = pauseFrom ? new Date(pauseFrom) : new Date();
  pauseDate.setHours(0,0,0,0);

  let sub;
  if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
    sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id, status: 'active' });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id });
  }
  if (!sub) {
    return res.json({ success: true, message: 'No active subscription found to pause' });
  }

  if (sub.status === 'paused') {
    return res.json({ success: true, message: 'Subscription is already paused' });
  }

  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { status: 'paused', pauseFrom: pauseDate } }
  );

  const deletedDeliveries = await Delivery.deleteMany({
    subscription: sub._id,
    deliveryDate: { $gte: pauseDate },
    status: { $in: ['scheduled', 'assigned'] }
  });

  await Subscription.updateOne(
    { _id: sub._id },
    { $inc: { remainingDeliveries: deletedDeliveries.deletedCount || 0 } }
  );

  res.json({ success: true, message: 'Subscription paused successfully' });
});

r.patch('/subscriptions/:id/resume', async (req, res) => {
  const { resumeDate } = req.body;
  const resumeD = resumeDate ? new Date(resumeDate) : new Date(Date.now() + 86400000);
  resumeD.setHours(0,0,0,0);

  let sub;
  if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
    sub = await Subscription.findOne({ _id: req.params.id, customer: req.auth.id });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id, status: 'paused' });
  }
  if (!sub) {
    sub = await Subscription.findOne({ customer: req.auth.id });
  }
  if (!sub) {
    return res.json({ success: true, message: 'No paused subscription found to resume' });
  }

  if (sub.status === 'active') {
    return res.json({ success: true, message: 'Subscription is already active' });
  }

  const remaining = sub.remainingDeliveries || 0;
  
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { status: 'active', pauseFrom: undefined, pauseTo: undefined, remainingDeliveries: 0 } }
  );

  if (remaining > 0) {
    await generateRemainingDeliveries(sub._id, resumeD, remaining);
  }

  res.json({ success: true, message: 'Subscription resumed successfully' });
});

r.delete('/subscriptions/:id', async (req, res) => {
  let sub;
  if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
    sub = await Subscription.findOneAndDelete({_id: req.params.id, customer: req.auth.id});
  }
  if (!sub) {
    sub = await Subscription.findOneAndDelete({ customer: req.auth.id });
  }
  if (!sub) throw new ApiError(404, 'Subscription not found');
  await Delivery.deleteMany({ subscription: sub._id, status: { $in: ['scheduled', 'pending', 'rescheduled'] }});
  res.json({success:true});
});

r.get('/deliveries',async(req,res)=>res.json({success:true,data:await Delivery.find({customer:req.auth.id}).populate('product').populate('partner','name phone').sort('deliveryDate')}));
r.get('/orders', async (req, res) => {
  const [deliveries, subscriptions] = await Promise.all([
    Delivery.find({ customer: req.auth.id })
      .populate('product')
      .populate('partner', 'name phone')
      .populate('subscription', 'cycle status totalAmount')
      .populate('payment', 'amount status metadata')
      .sort('-createdAt')
      .lean(),
    Subscription.find({ customer: req.auth.id, status: { $ne: 'pending_payment' } })
      .populate('product')
      .sort('-createdAt')
      .lean()
  ]);

  const combined = [];
  const addedSubIds = new Set();

  for (const sub of subscriptions) {
    combined.push({
      ...sub,
      type: 'subscription',
      cycle: sub.cycle || 'weekly',
      quantity: sub.quantity || 1
    });
    if (sub._id) addedSubIds.add(sub._id.toString());
  }

  for (const del of deliveries) {
    const subRefId = del.subscription?._id ? del.subscription._id.toString() : del.subscription?.toString();
    if (!subRefId || !addedSubIds.has(subRefId)) {
      combined.push({
        ...del,
        type: del.isExtra ? 'extra_milk' : 'delivery'
      });
    }
  }

  combined.sort((a, b) => new Date(b.createdAt || b.deliveryDate || 0) - new Date(a.createdAt || a.deliveryDate || 0));

  res.json({ success: true, data: combined });
});
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

r.delete('/me', async (req, res) => {
  const customerId = req.auth.id;
  console.log(`[DELETE /customer/me] 🗑️ Deleting account and all data for customer ID: ${customerId}`);
  const subsDel = await Subscription.deleteMany({ customer: customerId });
  const delivDel = await Delivery.deleteMany({ customer: customerId });
  const payDel = await Payment.deleteMany({ customer: customerId });
  const txnDel = await WalletTransaction.deleteMany({ customer: customerId });
  const userDel = await User.findByIdAndDelete(customerId);
  console.log(`[DELETE /customer/me] ✅ Deleted ${subsDel.deletedCount} subscriptions, ${delivDel.deletedCount} deliveries, ${payDel.deletedCount} payments, ${txnDel.deletedCount} transactions for user ${customerId}`);
  res.json({ success: true, message: 'Account deleted successfully' });
});

export default r;
