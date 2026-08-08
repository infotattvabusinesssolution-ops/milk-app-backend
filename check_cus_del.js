import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ phone: '+919348038244' });
    const deliveries = await db.collection('deliveries').find({ customer: user._id, deliveryDate: { $gte: new Date('2026-08-08') } }).toArray();
    console.log(`Deliveries: ${deliveries.length}`);
    deliveries.forEach(d => console.log(d.deliveryDate, d.status, d.slot));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
