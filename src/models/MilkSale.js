import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  quantity: { type: Number, required: true }, // in litres
  rateApplied: { type: Number, required: true }, // rate per litre at time of sale
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['initiated', 'in_progress', 'collected', 'rejected'], default: 'initiated' },
  expectedPickupTime: { type: Date },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin or specific vendor
}, { timestamps: true });

export const MilkSale = mongoose.model('MilkSale', schema);
