import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  addressId: { type: mongoose.Schema.Types.ObjectId, required: true },
  cycle: { type: String, enum: ['daily', 'weekly', 'monthly', 'onetime'], required: true },
  quantity: { type: Number, min: 0.5, required: true },
  slot: { type: String, default: 'Pending Allocation' },
  startDate: { type: Date, required: true },
  paidUntil: Date,
  nextPaymentDate: Date,
  status: { type: String, enum: ['pending_payment', 'active', 'paused', 'expired', 'cancelled'], default: 'pending_payment' },
  pauseFrom: Date,
  pauseTo: Date,
  skipDates: [Date],
  autoRenew: { type: Boolean, default: false },
  assignedPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const Subscription = mongoose.model('Subscription', schema);
