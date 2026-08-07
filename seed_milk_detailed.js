import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Category } from './src/models/Category.js';
import { Product } from './src/models/Product.js';
import { SubscriptionPlan } from './src/models/SubscriptionPlan.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Clear existing
    await Category.deleteMany({});
    await Product.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    console.log('Cleared existing catalog');

    // Categories
    const catFresh = await Category.create({ 
      name: 'Daily Fresh Milk', 
      description: 'Everyday fresh milk sourced directly from local farms. Untouched by human hands.', 
      image: 'https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022164/milkapp/seed/dtsduytj2lr3clyehscz.jpg', 
      displayOrder: 1,
      isFeatured: true,
      isActive: true 
    });
    const catPremium = await Category.create({ 
      name: 'Premium A2 Milk', 
      description: 'High nutrition A2 milk from indigenous Indian cow breeds like Gir and Sahiwal.', 
      image: 'https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022166/milkapp/seed/hbz5ugcgb2b4zbylcjqt.jpg', 
      displayOrder: 2,
      isFeatured: true,
      isActive: true 
    });

    // Products
    const pGir = await Product.create({
      name: 'Pure A2 Gir Cow Milk',
      category: catPremium._id,
      shortDescription: 'Sweet, highly digestible A2 milk from free-grazing indigenous Gir cows.',
      fullDescription: 'Our A2 Gir Cow Milk is sourced exclusively from purebred Gir cows fed on organic pasture. It is highly digestible, rich in A2 protein, and entirely free from antibiotics and synthetic hormones. Delivered raw and chilled to preserve natural enzymes.',
      benefits: 'Easy to digest, boosts immunity, excellent for brain development in children.',
      ingredients: '100% Pure Raw Gir Cow Milk',
      nutritionalInfo: 'Energy: 65 kcal, Protein: 3.2g, Carbohydrates: 4.8g, Fat: 4.0g, Calcium: 120mg (per 100ml)',
      storageInstructions: 'Boil immediately upon receipt. Refrigerate at 4°C.',
      expiryInfo: 'Consume within 2 days of delivery.',
      sku: 'GIR-A2-001',
      images: ['https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022167/milkapp/seed/pmorsnecyyzcfd3fpwuv.jpg'],
      taxPercentage: 0,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      isFeatured: true,
      isBestSeller: true,
      allowSubscription: true,
      isActive: true,
      variants: [
        { unit: '1 Litre', sku: 'GIR-A2-1L', regularPrice: 90, salePrice: 85, stockQuantity: 100 }, 
        { unit: '500 ml', sku: 'GIR-A2-500ML', regularPrice: 46, salePrice: 45, stockQuantity: 100 }
      ]
    });

    const pSahiwal = await Product.create({
      name: 'Organic Sahiwal Cow Milk',
      category: catPremium._id,
      shortDescription: 'Nutrient-dense A2 milk from Sahiwal cows. Known for its distinct sweet taste.',
      fullDescription: 'Experience the rich heritage of Indian dairy with our Sahiwal Cow Milk. The Sahiwal breed is known for producing milk with a naturally sweeter profile and higher butterfat content among indigenous breeds.',
      benefits: 'Rich in Omega-3, supports joint health, improves gut flora.',
      ingredients: '100% Pure Sahiwal Cow Milk',
      nutritionalInfo: 'Energy: 70 kcal, Protein: 3.4g, Fat: 4.5g, Calcium: 125mg (per 100ml)',
      storageInstructions: 'Boil before consumption. Keep refrigerated.',
      expiryInfo: '2 Days from date of packaging.',
      sku: 'SAH-A2-001',
      images: ['https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022171/milkapp/seed/kjighoc6ncgbxcfs28vo.jpg'],
      taxPercentage: 0,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      isFeatured: false,
      isBestSeller: false,
      allowSubscription: true,
      isActive: true,
      variants: [{ unit: '1 Litre', sku: 'SAH-A2-1L', regularPrice: 85, salePrice: 0, stockQuantity: 100 }]
    });

    const pBuffalo = await Product.create({
      name: 'Farm Fresh Buffalo Milk',
      category: catFresh._id,
      shortDescription: 'Thick, high-fat buffalo milk. Yields a thick layer of malai.',
      fullDescription: 'Sourced from healthy Murrah buffaloes, this milk has a rich, creamy texture and a minimum fat content of 6.5%. Perfect for making thick curd, paneer, and authentic Indian sweets.',
      benefits: 'High in calcium, excellent source of healthy fats, promotes bone health.',
      ingredients: '100% Pure Buffalo Milk',
      nutritionalInfo: 'Energy: 97 kcal, Protein: 3.7g, Fat: 6.9g, Calcium: 169mg (per 100ml)',
      storageInstructions: 'Boil upon receipt. Refrigerate to set thick malai.',
      expiryInfo: 'Consume within 2 days.',
      sku: 'BUF-FM-001',
      images: ['https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022169/milkapp/seed/ki4ilcp0jdz0nkubovpm.jpg'],
      taxPercentage: 0,
      minOrderQuantity: 1,
      maxOrderQuantity: 20,
      isFeatured: true,
      isBestSeller: true,
      allowSubscription: true,
      isActive: true,
      variants: [
        { unit: '1 Litre', sku: 'BUF-FM-1L', regularPrice: 75, salePrice: 70, stockQuantity: 200 }, 
        { unit: '500 ml', sku: 'BUF-FM-500ML', regularPrice: 38, salePrice: 38, stockQuantity: 200 }
      ]
    });

    const pFullCream = await Product.create({
      name: 'Full Cream Cow Milk',
      category: catFresh._id,
      shortDescription: 'Rich and creamy cow milk with 6% fat. Ideal for growing children.',
      fullDescription: 'Standardized to contain exactly 6% fat, this cow milk is incredibly creamy and delicious. It is pasteurized and homogenized to ensure a consistent, rich texture in every sip.',
      benefits: 'Energy dense, essential vitamins A & D, great for active kids.',
      ingredients: 'Pasteurized Full Cream Cow Milk',
      nutritionalInfo: 'Energy: 87 kcal, Protein: 3.3g, Fat: 6.0g, Calcium: 115mg (per 100ml)',
      storageInstructions: 'Keep refrigerated below 4°C at all times.',
      expiryInfo: '3 Days from packaging.',
      sku: 'FC-COW-001',
      images: ['https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022170/milkapp/seed/rjjef45qamratmpwifnu.jpg'],
      taxPercentage: 0,
      minOrderQuantity: 1,
      maxOrderQuantity: 20,
      isFeatured: false,
      isBestSeller: false,
      allowSubscription: true,
      isActive: true,
      variants: [{ unit: '1 Litre', sku: 'FC-COW-1L', regularPrice: 70, salePrice: 68, stockQuantity: 300 }]
    });

    const pToned = await Product.create({
      name: 'Light Toned Milk',
      category: catFresh._id,
      shortDescription: 'Healthy, low-fat toned milk (3% fat). Perfect for daily consumption.',
      fullDescription: 'For those watching their calorie intake but still wanting their daily dose of calcium. Our toned milk is light on the stomach, highly nutritious, and perfect for your daily coffee, tea, or cereal.',
      benefits: 'Low calorie, helps in weight management, highly fortified.',
      ingredients: 'Pasteurized Toned Milk',
      nutritionalInfo: 'Energy: 58 kcal, Protein: 3.2g, Fat: 3.0g, Calcium: 120mg (per 100ml)',
      storageInstructions: 'Store in refrigerator. Do not freeze.',
      expiryInfo: '3 Days from packaging.',
      sku: 'TM-001',
      images: ['https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022172/milkapp/seed/clxuxxx2pti8czaoqryj.jpg'],
      taxPercentage: 0,
      minOrderQuantity: 1,
      maxOrderQuantity: 30,
      isFeatured: false,
      isBestSeller: true,
      allowSubscription: true,
      isActive: true,
      variants: [{ unit: '1 Litre', sku: 'TM-1L', regularPrice: 54, salePrice: 0, stockQuantity: 400 }]
    });

    // Subscriptions
    await SubscriptionPlan.create({
      name: 'Daily Gir Cow A2 (Monthly)',
      description: 'Get 1 Litre of pure Gir cow milk delivered every morning before 7 AM for 30 days. Experience the purest A2 habit.',
      image: 'https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022167/milkapp/seed/pmorsnecyyzcfd3fpwuv.jpg',
      product: pGir._id,
      variantUnit: '1 Litre',
      quantityPerDelivery: 1,
      totalDeliveries: 30,
      durationDays: 30,
      frequency: 'Daily',
      selectedWeekdays: [],
      originalPrice: 2700, // 30 * 90
      discountedPrice: 2550,
      taxAmount: 0,
      deliveryCharge: 0,
      finalPayableAmount: 2550,
      pauseAllowance: 5,
      skipAllowance: 5,
      cancellationRules: 'Cancel anytime. Pro-rata refund processed within 3-5 business days.',
      isActive: true,
      isFeatured: true,
      isRecommended: true
    });

    await SubscriptionPlan.create({
      name: 'Healthy Family Toned Milk',
      description: 'Daily delivery of 1L Light Toned Milk for 30 days. Keep your family fit and healthy without skipping essential calcium.',
      image: 'https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022172/milkapp/seed/clxuxxx2pti8czaoqryj.jpg',
      product: pToned._id,
      variantUnit: '1 Litre',
      quantityPerDelivery: 1,
      totalDeliveries: 30,
      durationDays: 30,
      frequency: 'Daily',
      selectedWeekdays: [],
      originalPrice: 1620, // 30 * 54
      discountedPrice: 1550,
      taxAmount: 0,
      deliveryCharge: 0,
      finalPayableAmount: 1550,
      pauseAllowance: 3,
      skipAllowance: 3,
      cancellationRules: 'No cancellation fees after 15 deliveries.',
      isActive: true,
      isFeatured: false,
      isRecommended: true
    });

    await SubscriptionPlan.create({
      name: 'Weekend Buffalo Milk (Thick Malai)',
      description: 'Get 2 Litres of Buffalo milk every Saturday and Sunday for making fresh paneer, sweets, or thick curd at home over the weekend.',
      image: 'https://res.cloudinary.com/dqyd8al5r/image/upload/v1786022169/milkapp/seed/ki4ilcp0jdz0nkubovpm.jpg',
      product: pBuffalo._id,
      variantUnit: '1 Litre',
      quantityPerDelivery: 2,
      totalDeliveries: 8,
      durationDays: 28,
      frequency: 'Selected Weekdays',
      selectedWeekdays: ['Saturday', 'Sunday'],
      originalPrice: 1200, // 8 * 2 * 75
      discountedPrice: 1100,
      taxAmount: 0,
      deliveryCharge: 0,
      finalPayableAmount: 1100,
      pauseAllowance: 0,
      skipAllowance: 1,
      cancellationRules: 'Non-refundable.',
      isActive: true,
      isFeatured: true,
      isRecommended: false
    });

    console.log('Detailed Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during detailed seed:', err);
    process.exit(1);
  }
};

run();
