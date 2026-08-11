import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
const client=env.razorpayKeyId&&env.razorpayKeySecret?new Razorpay({key_id:env.razorpayKeyId,key_secret:env.razorpayKeySecret}):null;
export async function createProviderOrder(amount,receipt){
 if(!Number.isFinite(Number(amount)) || Number(amount)<=0) throw new ApiError(400,'Invalid payment amount');
 if(!client) return {id:`demo_order_${Date.now()}`,amount:Math.round(amount*100),currency:'INR',demo:true};
 return client.orders.create({amount:Math.round(amount*100),currency:'INR',receipt});
}
export function verifySignature(orderId,paymentId,signature){
 if(!client) return signature==='demo_signature';
 const expected=crypto.createHmac('sha256',env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
 return expected===signature;
}
export function verifyWebhook(rawBody,signature){
 if(!env.razorpayWebhookSecret) throw new ApiError(500,'Webhook secret is not configured');
 const expected=crypto.createHmac('sha256',env.razorpayWebhookSecret).update(rawBody).digest('hex');
 return expected===signature;
}
