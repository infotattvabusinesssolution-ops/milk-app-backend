import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });


const clearPurchases = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const phone = { $regex: '9348038244' };
    const user = await mongoose.connection.db.collection('users').findOne({ phone });
    
    if (!user) {
      console.log(`User with phone ${phone} not found.`);
      process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user._id})`);

    const subRes = await mongoose.connection.db.collection('subscriptions').deleteMany({ customer: user._id });
    console.log(`Deleted ${subRes.deletedCount} subscriptions`);
    
    const delRes = await mongoose.connection.db.collection('deliveries').deleteMany({ customer: user._id });
    console.log(`Deleted ${delRes.deletedCount} deliveries`);

    const payRes = await mongoose.connection.db.collection('payments').deleteMany({ customer: user._id });
    console.log(`Deleted ${payRes.deletedCount} payments`);

    // Optionally refund wallet or clear wallet transactions if required
    // const walletRes = await mongoose.connection.db.collection('wallettransactions').deleteMany({ customer: user._id });
    // console.log(`Deleted ${walletRes.deletedCount} wallet transactions`);
    
    // Reset user wallet balance to 0 ? The user didn't ask to reset wallet, just purchases. Let's just delete purchases.

    console.log('Done cleaning up user purchases.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

clearPurchases();
