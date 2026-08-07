import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';
import { SubscriptionPlan } from './models/SubscriptionPlan.js';

dotenv.config({ path: '.env' });
// Actually dotenv.config() defaults to .env in current working directory, if we run it from milk-app-backend it works.

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Clear existing collections
    console.log('Clearing existing data...');
    await Category.deleteMany({});
    await Product.deleteMany({});
    await SubscriptionPlan.deleteMany({});

    // 1. Create Categories
    const categories = await Category.create([
      {
        name: 'Fresh Milk',
        description: '100% pure, farm-fresh milk delivered within hours of milking. Untouched by human hands.',
        image: '/categories/cat-fresh-milk.png',
        displayOrder: 1,
        isFeatured: true,
        isActive: true
      },
      {
        name: 'Dairy Essentials',
        description: 'Everyday dairy products made from our pure farm milk, including Curd, Paneer, and Butter.',
        image: '/categories/cat-dairy-essentials.png',
        displayOrder: 2,
        isFeatured: true,
        isActive: true
      },
      {
        name: 'Traditional Ghee',
        description: 'Authentic, bilona-churned A2 ghee crafted using ancient Vedic methods for maximum nutrition.',
        image: '/categories/cat-traditional-ghee.png',
        displayOrder: 3,
        isFeatured: false,
        isActive: true
      }
    ]);
    console.log('Categories created.');

    const freshMilkId = categories[0]._id;
    const essentialsId = categories[1]._id;
    const gheeId = categories[2]._id;

    // 2. Create Products
    const products = await Product.create([
      {
        name: 'Pure A2 Gir Cow Milk',
        category: freshMilkId,
        shortDescription: 'Sweet, creamy A2 milk from free-grazing indigenous Gir cows.',
        fullDescription: 'Our A2 Gir Cow Milk is sourced exclusively from purebred Gir cows fed on organic pasture. It is highly digestible, rich in A2 protein, and entirely free from antibiotics and synthetic hormones. Delivered raw and chilled to preserve natural enzymes.',
        benefits: 'Easy to digest, boosts immunity, excellent for brain development in children.',
        ingredients: '100% Pure Raw Cow Milk',
        nutritionalInfo: 'Energy: 62kcal, Protein: 3.3g, Calcium: 120mg (per 100ml)',
        storageInstructions: 'Boil immediately upon receipt. Refrigerate at 4°C.',
        expiryInfo: 'Consume within 2 days of delivery.',
        sku: 'GIR-MILK-001',
        taxPercentage: 0,
        minOrderQuantity: 1,
        maxOrderQuantity: 10,
        variants: [
          { unit: '500ml', regularPrice: 45, salePrice: 45, stockQuantity: 100, sku: 'GIR-500ML' },
          { unit: '1 Litre', regularPrice: 85, salePrice: 80, stockQuantity: 150, sku: 'GIR-1L' }
        ],
        isFeatured: true,
        isBestSeller: true,
        allowSubscription: true,
        isActive: true,
        images: ['/products/gir-cow-milk.png']
      },
      {
        name: 'Farm Fresh Buffalo Milk',
        category: freshMilkId,
        shortDescription: 'Thick, high-fat buffalo milk perfect for making thick curd, paneer, and sweets.',
        fullDescription: 'Sourced from our healthy Murrah buffaloes, this milk has a rich, creamy texture and a minimum fat content of 6.5%. It yields a thick layer of malai (cream) and is perfect for traditional Indian chai and homemade sweets.',
        benefits: 'High in calcium, excellent source of healthy fats, promotes bone health.',
        ingredients: '100% Pure Buffalo Milk',
        storageInstructions: 'Boil immediately upon receipt. Refrigerate at 4°C.',
        expiryInfo: 'Consume within 2 days.',
        sku: 'BUFF-MILK-001',
        taxPercentage: 0,
        minOrderQuantity: 1,
        maxOrderQuantity: 10,
        variants: [
          { unit: '1 Litre', regularPrice: 75, salePrice: 75, stockQuantity: 200, sku: 'BUFF-1L' }
        ],
        isFeatured: false,
        isBestSeller: false,
        allowSubscription: true,
        isActive: true,
        images: ['/products/buffalo-milk.png']
      },
      {
        name: 'Fresh Malai Paneer',
        category: essentialsId,
        shortDescription: 'Super soft, melt-in-the-mouth paneer made fresh daily.',
        fullDescription: 'Handcrafted in small batches using whole buffalo milk and natural lemon juice. We do not use any artificial coagulants or preservatives. The result is a spongy, soft paneer that absorbs gravies perfectly and won\'t turn rubbery when cooked.',
        benefits: 'High protein content, excellent for muscle building, low in carbs.',
        ingredients: 'Pasteurized Buffalo Milk, Natural Lemon Extract.',
        storageInstructions: 'Keep refrigerated in an airtight container submerged in water.',
        expiryInfo: 'Consume within 3 days.',
        sku: 'PANEER-001',
        taxPercentage: 5,
        minOrderQuantity: 1,
        maxOrderQuantity: 5,
        variants: [
          { unit: '250g', regularPrice: 120, salePrice: 120, stockQuantity: 50, sku: 'PAN-250G' },
          { unit: '500g', regularPrice: 230, salePrice: 210, stockQuantity: 30, sku: 'PAN-500G' }
        ],
        isFeatured: false,
        isBestSeller: true,
        allowSubscription: true,
        isActive: true,
        images: ['/products/fresh-paneer.png']
      },
      {
        name: 'Vedic A2 Bilona Ghee',
        category: gheeId,
        shortDescription: 'Golden, granular A2 ghee made from cultured curd using the traditional wooden churner.',
        fullDescription: 'We don\'t make ghee from direct cream. We follow the ancient Vedic \'Bilona\' process: A2 milk is boiled, set into curd, and then churned clockwise and anti-clockwise using a wooden bilona to extract makhhan (butter), which is then slow-cooked over a cow-dung fire.',
        benefits: 'Improves gut health, rich in Omega-3, high smoke point, acts as a natural immunity booster.',
        ingredients: 'A2 Cow Milk Curd.',
        storageInstructions: 'Store in a cool, dry place away from direct sunlight. Do not refrigerate.',
        expiryInfo: 'Best before 12 months from packing.',
        sku: 'GHEE-001',
        taxPercentage: 12,
        minOrderQuantity: 1,
        maxOrderQuantity: 2,
        variants: [
          { unit: '500ml Jar', regularPrice: 950, salePrice: 950, stockQuantity: 20, sku: 'GHEE-500ML' },
          { unit: '1 Litre Jar', regularPrice: 1800, salePrice: 1750, stockQuantity: 15, sku: 'GHEE-1L' }
        ],
        isFeatured: true,
        isBestSeller: true,
        allowSubscription: false,
        isActive: true,
        images: ['/products/bilona-ghee.png']
      }
    ]);
    console.log('Products created.');

    const girCowMilk = products[0];
    const paneer = products[2];

    // 3. Create Subscription Plans
    await SubscriptionPlan.create([
      {
        name: 'The Daily A2 Habit',
        description: 'Get 1 Litre of pure A2 milk delivered every morning before 7 AM for an entire month. Save ₹150!',
        image: '/products/gir-cow-milk.png',
        product: girCowMilk._id,
        variantUnit: '1 Litre',
        quantityPerDelivery: 1,
        totalDeliveries: 30,
        durationDays: 30,
        frequency: 'Daily',
        selectedWeekdays: [],
        originalPrice: 2550, // 85 * 30
        discountedPrice: 2400,
        finalPayableAmount: 2400,
        pauseAllowance: 3,
        skipAllowance: 2,
        cancellationRules: 'Can be cancelled at any time. Remaining balance will be refunded to wallet.',
        isActive: true,
        isFeatured: true,
        isRecommended: true
      },
      {
        name: 'Weekend Paneer Delight',
        description: 'Fresh paneer delivered every Saturday morning just in time for the weekend feast.',
        image: '/products/fresh-paneer.png',
        product: paneer._id,
        variantUnit: '500g',
        quantityPerDelivery: 1,
        totalDeliveries: 4,
        durationDays: 30,
        frequency: 'Selected Weekdays',
        selectedWeekdays: ['Saturday'],
        originalPrice: 920, // 230 * 4
        discountedPrice: 850,
        finalPayableAmount: 850,
        pauseAllowance: 1,
        skipAllowance: 1,
        isActive: true,
        isFeatured: false,
        isRecommended: false
      }
    ]);
    console.log('Subscription Plans created.');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
