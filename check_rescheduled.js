import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    
    // Find all 'rescheduled' deliveries that are the ONLY active delivery for that subscription on that date.
    // Actually it's easier to just change them back if they want, but let me see how many there are.
    const count = await db.collection('deliveries').countDocuments({ status: 'rescheduled' });
    console.log(`There are ${count} rescheduled deliveries.`);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
