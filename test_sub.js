const mongoose = require('mongoose');
const { Subscription } = require('./src/models/Subscription');
const { Delivery } = require('./src/models/Delivery');

mongoose.connect('mongodb://127.0.0.1:27017/milkapp').then(async () => {
  console.log('Connected');
  
  // Find a test subscription
  const sub = await Subscription.findOne({ status: 'active' });
  if (!sub) { console.log('No active sub'); process.exit(0); }
  
  const count = await Delivery.countDocuments({ subscription: sub._id });
  console.log('Initial deliveries:', count);
  console.log('Paid until:', sub.paidUntil);
  
  process.exit(0);
});
