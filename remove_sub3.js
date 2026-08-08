import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    
    // Find all users and check their phone numbers
    const users = await db.collection('users').find({}).toArray();
    console.log(`Total users: ${users.length}`);
    
    for (let u of users) {
      const subs = await db.collection('subscriptions').find({ customer: u._id }).toArray();
      if (subs.length > 0) {
        console.log(`User ${u.name} (${u.phone}) has ${subs.length} subscriptions`);
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
