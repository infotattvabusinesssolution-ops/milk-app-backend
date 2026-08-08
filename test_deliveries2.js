import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      const deliveries = await db.collection('deliveries').find({ 
        subscription: new mongoose.Types.ObjectId("6a76e72302761e805266de13")
      }).sort({deliveryDate: 1}).toArray();
      
      console.log('All Deliveries for sub:');
      deliveries.forEach(d => {
        console.log(`ID: ${d._id}, Date: ${d.deliveryDate}, Status: ${d.status}`);
      });
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
