import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { SubscriptionPlan } from './src/models/SubscriptionPlan.js';
import { Product } from './src/models/Product.js';

const createPlan = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Find a product
    const product = await Product.findOne({});
    if (!product) {
        console.log('No products found, please create a product first');
        process.exit(1);
    }
    
    const price = product.pricePerUnit || (product.variants && product.variants.length > 0 ? product.variants[0].regularPrice : 50) || 50;
    
    // Create new plan
    const plan = await SubscriptionPlan.create({
      name: 'Pay-As-You-Go Daily Plan',
      description: 'Get fresh milk delivered to your doorstep every day. You only pay for what gets delivered on a daily basis.',
      image: '/products/daily_milk_plan.png',
      product: product._id,
      variantUnit: '1 L',
      quantityPerDelivery: 1,
      totalDeliveries: 30, // Just a placeholder, as it's daily billing
      durationDays: 30, // Also a placeholder
      frequency: 'Everyday',
      billingCycle: 'daily',
      originalPrice: price,
      discountedPrice: price,
      finalPayableAmount: price,
      pauseAllowance: 30, // Basically unlimited pauses since it's pay-as-you-go
      skipAllowance: 30,
      cancellationRules: 'Can be cancelled at any time.',
      isActive: true,
      isFeatured: false,
      isRecommended: false
    });
    
    console.log('Successfully created the daily pay-as-you-go delivery plan:', plan.name);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createPlan();
