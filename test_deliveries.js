import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      const deliveries = await db.collection('deliveries').find({ 
        deliveryDate: { 
          $gte: new Date('2026-08-08'), 
          $lt: new Date('2026-08-11') 
        } 
      }).toArray();
      
      console.log('Deliveries between 8th and 10th:');
      deliveries.forEach(d => {
        console.log(`ID: ${d._id}, Date: ${d.deliveryDate}, Status: ${d.status}, Sub: ${d.subscription}`);
      });
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
