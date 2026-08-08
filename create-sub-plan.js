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
      name: '1 Month Daily Milk Plan',
      description: 'Get fresh milk delivered to your doorstep every day for a whole month.',
      image: '/products/monthly_milk_plan.png',
      product: product._id,
      variantUnit: '1 L',
      quantityPerDelivery: 1,
      totalDeliveries: 30,
      durationDays: 30,
      frequency: 'Everyday',
      billingCycle: 'monthly',
      originalPrice: price * 30,
      discountedPrice: (price * 30) * 0.9, // 10% discount
      finalPayableAmount: (price * 30) * 0.9,
      pauseAllowance: 3,
      skipAllowance: 3,
      cancellationRules: 'Can be cancelled at any time before the next billing cycle.',
      isActive: true,
      isFeatured: true,
      isRecommended: true
    });
    
    console.log('Successfully created the daily monthly delivery plan:', plan.name);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createPlan();
