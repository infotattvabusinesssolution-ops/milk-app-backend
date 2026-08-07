import { Delivery } from '../models/Delivery.js';
import { Payment } from '../models/Payment.js';
import { Subscription } from '../models/Subscription.js';

const atStart=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
export async function generateDeliveriesForPayment(paymentId){
 const payment=await Payment.findById(paymentId);
 if(!payment||payment.status!=='paid') return [];
 const sub=await Subscription.findById(payment.subscription).populate('customer product');
 if(!sub) return [];
 const days=payment.cycle==='daily'?1:payment.cycle==='weekly'?7:30;
 const address=sub.customer.addresses.id(sub.addressId);
 const docs=[];
  for(let i=0;i<days;i++){
    const date=atStart(sub.startDate); date.setDate(date.getDate()+i);
    
    // Delivery Frequency Check
    if (sub.deliveryFrequency === 'selected_days' && sub.selectedDays && sub.selectedDays.length > 0) {
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (!sub.selectedDays.includes(weekday)) {
        continue; // Skip this day
      }
    }

    const exists=await Delivery.findOne({subscription:sub._id,deliveryDate:date});
    if(exists) continue;
    docs.push(await Delivery.create({
      customer: sub.customer._id,
      subscription: sub._id,
      product: sub.product._id,
      deliveryDate: date,
      quantity: sub.quantity,
      slot: sub.slot,
      addressSnapshot: address?.toObject() || {},
      payment: payment._id,
      otp: String(Math.floor(1000+Math.random()*9000)),
      partner: sub.assignedPartner || null,
      status: sub.assignedPartner ? 'assigned' : 'scheduled'
    }));
  }
 const paidUntil=atStart(sub.startDate);paidUntil.setDate(paidUntil.getDate()+days-1);
 sub.paidUntil=paidUntil; sub.nextPaymentDate=new Date(paidUntil.getTime()+86400000); sub.status='active'; await sub.save();
 return docs;
}
