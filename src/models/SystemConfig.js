import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: String
}, { timestamps: true });

export const SystemConfig = mongoose.model('SystemConfig', schema);
