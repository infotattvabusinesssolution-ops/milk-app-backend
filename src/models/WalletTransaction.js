import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  referenceId: { type: String } // Can be Payment ID or Order ID
}, { timestamps: true });

export const WalletTransaction = mongoose.model('WalletTransaction', schema);
