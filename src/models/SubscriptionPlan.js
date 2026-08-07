import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String },
  
  // Product Linking
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantUnit: { type: String, required: true }, // e.g. "500 ml"
  
  // Delivery Specs
  quantityPerDelivery: { type: Number, required: true, min: 1 },
  totalDeliveries: { type: Number, required: true, min: 1 },
  durationDays: { type: Number },
  
  // Frequency Configuration
  frequency: { type: String, enum: ['One Time', 'Everyday', 'Selected Days'], required: true },
  selectedWeekdays: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
  billingCycle: { type: String, enum: ['daily', 'weekly', 'monthly', 'onetime'], default: 'monthly' },
  
  // Financials
  originalPrice: { type: Number, required: true },
  discountedPrice: { type: Number },
  taxAmount: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  finalPayableAmount: { type: Number, required: true },
  
  // Subscription Rules
  pauseAllowance: { type: Number, default: 0 }, // max times they can pause
  skipAllowance: { type: Number, default: 0 }, // max times they can skip
  cancellationRules: { type: String },
  
  // Status & Display Flags
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isRecommended: { type: Boolean, default: false }
}, { timestamps: true });

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', schema);
