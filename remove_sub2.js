import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ phone: '9348038244' });
    if (!user) {
      console.log('User not found.');
      process.exit(0);
    }
    
    console.log(`Found user: ${user.name}`);
    
    const subs = await db.collection('subscriptions').find({ customer: user._id }).toArray();
    console.log(`Found ${subs.length} subscriptions for this user.`);
    
    for (let sub of subs) {
      const prod = await db.collection('products').findOne({ _id: sub.product });
      console.log(`Sub ID: ${sub._id}, Product: ${prod ? prod.name : 'Unknown'}`);
      
      // Since they want "sudh desi milk" removed, let's delete it if it matches
      if (prod && prod.name.toLowerCase().includes('shudh')) {
        await db.collection('subscriptions').deleteOne({ _id: sub._id });
        const delRes = await db.collection('deliveries').deleteMany({ subscription: sub._id });
        console.log(`Deleted Sub ID: ${sub._id} and ${delRes.deletedCount} deliveries.`);
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
