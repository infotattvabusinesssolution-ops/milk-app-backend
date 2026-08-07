import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const fixDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Drop the problematic index
    await mongoose.connection.collection('users').dropIndex('phone_1');
    console.log('Successfully dropped phone_1 index from users collection');
    
  } catch (err) {
    console.log('Error dropping index (it may not exist):', err.message);
  } finally {
    mongoose.disconnect();
  }
};

fixDb();
