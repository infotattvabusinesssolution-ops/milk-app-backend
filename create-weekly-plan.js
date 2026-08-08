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
      name: 'Custom Weekly Plan',
      description: 'Get fresh milk delivered on your selected days every week.',
      image: '/products/weekly_selected_days_plan.png',
      product: product._id,
      variantUnit: '1 L',
      quantityPerDelivery: 1,
      totalDeliveries: 3, // Assuming 3 days a week
      durationDays: 7, 
      frequency: 'Selected Days',
      selectedWeekdays: ['Monday', 'Wednesday', 'Friday'],
      billingCycle: 'weekly',
      originalPrice: price * 3,
      discountedPrice: (price * 3) * 0.95, // 5% discount for weekly subscription
      finalPayableAmount: (price * 3) * 0.95,
      pauseAllowance: 1, 
      skipAllowance: 1,
      cancellationRules: 'Can be cancelled at any time before the next billing cycle.',
      isActive: true,
      isFeatured: false,
      isRecommended: true
    });
    
    console.log('Successfully created the customized weekly delivery plan:', plan.name);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createPlan();
