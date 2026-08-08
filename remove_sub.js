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
      console.log(`Sub ID: ${s._id}, Product: ${p.name}, Cycle: ${s.cycle}`);
      if (p.name.toLowerCase().includes('shudh desi') && s.cycle === 'monthly') {
         await db.collection('subscriptions').deleteOne({ _id: s._id });
         await db.collection('deliveries').deleteMany({ subscription: s._id });
         console.log(`DELETED Sub ID: ${s._id} and its deliveries.`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
