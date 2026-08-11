import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Subscription } from '../models/Subscription.js';
import { Product } from '../models/Product.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/apiError.js';
import { createProviderOrder,verifySignature } from '../services/paymentService.js';
import { generateDeliveriesForPayment } from '../services/deliveryService.js';
const r=Router();
r.post('/create-order', requireAuth('customer'), async (req, res) => {
  const subscription = await Subscription.findOne({ _id: req.body.subscriptionId, customer: req.auth.id });
  if (!subscription) throw new ApiError(404, 'Subscription not found');

  const product = await Product.findById(subscription.product);
  if (!product) throw new ApiError(404, 'Product not found');

  const primaryVariant = product.variants?.[0];
  const variantPrice = primaryVariant?.salePrice > 0 ? primaryVariant.salePrice : primaryVariant?.regularPrice;
  const unitPrice = Number(variantPrice ?? product.pricePerUnit);
  const quantity = Number(subscription.quantity);
  const days = subscription.cycle === 'daily' ? 1 : subscription.cycle === 'weekly' ? 7 : 30;
  const amount = Math.round((unitPrice * quantity * days + Number.EPSILON) * 100) / 100;

  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Unable to calculate a valid payment amount for this subscription');
  }

  const payment = await Payment.create({
    customer: req.auth.id,
    subscription: subscription._id,
    amount,
    cycle: subscription.cycle
  });
  const order = await createProviderOrder(amount, payment.id);
  payment.providerOrderId = order.id;
  await payment.save();

  res.status(201).json({
    success: true,
    data: { payment, providerOrder: order, keyId: process.env.RAZORPAY_KEY_ID || '' }
  });
});
r.post('/verify',requireAuth('customer'),async(req,res)=>{const {providerOrderId,providerPaymentId,signature}=req.body;const p=await Payment.findOne({providerOrderId,customer:req.auth.id});if(!p)throw new ApiError(404,'Payment not found');if(!verifySignature(providerOrderId,providerPaymentId,signature))throw new ApiError(400,'Payment signature verification failed');p.status='paid';p.providerPaymentId=providerPaymentId;p.paidAt=new Date();await p.save();const deliveries=await generateDeliveriesForPayment(p._id);res.json({success:true,data:{payment:p,deliveriesCreated:deliveries.length}});});
r.post('/demo-success',requireAuth('customer'),async(req,res)=>{const p=await Payment.findOne({_id:req.body.paymentId,customer:req.auth.id});if(!p)throw new ApiError(404,'Payment not found');p.status='paid';p.providerPaymentId=`demo_pay_${Date.now()}`;p.paidAt=new Date();await p.save();const ds=await generateDeliveriesForPayment(p._id);res.json({success:true,data:{payment:p,deliveriesCreated:ds.length}});});
export default r;
