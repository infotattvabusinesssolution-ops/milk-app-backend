import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Delivery = mongoose.connection.db.collection('deliveries');
  const sample = await Delivery.findOne();
  console.log(JSON.stringify(sample.addressSnapshot, null, 2));
  process.exit(0);
});
