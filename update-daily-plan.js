import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { SubscriptionPlan } from './src/models/SubscriptionPlan.js';

const updatePlan = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { name: 'Pay-As-You-Go Daily Plan' },
      { 
        $set: { 
          variantUnit: '65 Litre'
        } 
      },
      { new: true }
    );
    
    if (plan) {
      console.log('Successfully updated the daily plan with variant unit 65 Litre.');
    } else {
      console.log('Plan not found.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updatePlan();
