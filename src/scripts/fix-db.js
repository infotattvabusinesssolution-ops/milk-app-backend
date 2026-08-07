import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const fixDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Remove null phone numbers
    const result = await mongoose.connection.db.collection('users').updateMany(
      { phone: null },
      { $unset: { phone: 1 } }
    );
    console.log(`Removed null phone from ${result.modifiedCount} users`);
    
    // Drop index
    try {
      await mongoose.connection.db.collection('users').dropIndex('phone_1');
      console.log('Dropped phone_1 index');
    } catch (e) {
      console.log('Index phone_1 not found or already dropped');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixDb();
