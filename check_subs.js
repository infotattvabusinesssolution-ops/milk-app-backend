import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ phone: '+919348038244' });
    const subs = await db.collection('subscriptions').find({ customer: user._id }).toArray();
    for (let s of subs) {
      const p = await db.collection('products').findOne({ _id: s.product });
      console.log(`Sub: ${p.name}, Start: ${s.startDate}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
