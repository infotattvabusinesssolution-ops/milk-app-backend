import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const clean = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Clear all subscriptions
    const subRes = await mongoose.connection.db.collection('subscriptions').deleteMany({});
    console.log(`Deleted ${subRes.deletedCount} subscriptions`);
    
    // Clear all deliveries
    const delRes = await mongoose.connection.db.collection('deliveries').deleteMany({});
    console.log(`Deleted ${delRes.deletedCount} deliveries`);

    // Clear all payments
    const payRes = await mongoose.connection.db.collection('payments').deleteMany({});
    console.log(`Deleted ${payRes.deletedCount} payments`);

    console.log('Successfully cleaned all customer plans, deliveries, and payments.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

clean();
