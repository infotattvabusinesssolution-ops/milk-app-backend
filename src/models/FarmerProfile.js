import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  profilePhotoUrl: { type: String },
  address: {
    house: String,
    street: String,
    city: String,
    pincode: String,
    state: String,
    lat: Number,
    lng: Number
  },
  kyc: {
    aadhaarFrontUrl: String,
    aadhaarBackUrl: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }
}, { timestamps: true });

export const FarmerProfile = mongoose.model('FarmerProfile', schema);
