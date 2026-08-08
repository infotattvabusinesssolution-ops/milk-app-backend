const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'test@example.com' });
  const token = 'YOUR_CUSTOMER_TOKEN'; // I don't have the token, I'll just query the db directly
  
  const deliveries = await db.collection('deliveries').find({ 
    customer: user._id, 
    deliveryDate: { 
      $gte: new Date('2026-08-08'), 
      $lt: new Date('2026-08-11') 
    } 
  }).toArray();
  
  console.log("Found Deliveries for test@example.com:");
  deliveries.forEach(d => console.log(d.deliveryDate, d.status));
  process.exit(0);
}
run();
