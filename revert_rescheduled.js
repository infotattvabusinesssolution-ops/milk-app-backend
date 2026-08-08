import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    
    // Find all 'rescheduled' deliveries that are not cancelled or failed.
    const deliveries = await db.collection('deliveries').find({ status: 'rescheduled' }).toArray();
    let fixed = 0;
    
    for (let d of deliveries) {
      // Revert them to 'scheduled' because they shouldn't have been 'rescheduled' automatically
      // if they only had their slot assigned for the first time.
      await db.collection('deliveries').updateOne(
        { _id: d._id },
        { $set: { status: 'scheduled' } }
      );
      fixed++;
    }
    
    console.log(`Reverted ${fixed} deliveries back to 'scheduled'.`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
