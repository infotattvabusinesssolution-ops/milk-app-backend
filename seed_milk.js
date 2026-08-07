import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImage = async (imagePath) => {
  if (!imagePath) return 'https://via.placeholder.com/500';
  try {
    const res = await cloudinary.uploader.upload(imagePath, { folder: 'milkapp/seed' });
    console.log('Uploaded:', imagePath, '->', res.secure_url);
    return res.secure_url;
  } catch (err) {
    console.error('Failed to upload', imagePath, err);
    return 'https://via.placeholder.com/500';
  }
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Mongoose Models
    const Category = mongoose.models.Category || mongoose.model('Category', new mongoose.Schema({
      name: String, description: String, image: String, isActive: Boolean
    }));
    
    const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({
      name: String, description: String, category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      images: [String], isActive: Boolean, 
      variants: [{ unit: String, price: Number, stock: Number }]
    }));
    
    const SubscriptionPlan = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', new mongoose.Schema({
      name: String, description: String, product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productVariantId: mongoose.Schema.Types.ObjectId, frequency: String,
      deliveries: Number, price: Number, originalPrice: Number, image: String, isActive: Boolean
    }));
    const Cart = mongoose.models.Cart || mongoose.model('Cart', new mongoose.Schema({}));
    const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', new mongoose.Schema({}));
    const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', new mongoose.Schema({}));
    const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}));

    // Clear existing
    await Category.deleteMany({});
    await Product.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    await Cart.deleteMany({});
    await Subscription.deleteMany({});
    await Delivery.deleteMany({});
    await Order.deleteMany({});
    console.log('Cleared existing catalog and transactions');

    // Upload category image
    const rawMilkImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\cat_fresh_milk_1786013867620.png');
    const premiumMilkImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\cat_dairy_essentials_1786013878902.png');
    
    // Categories
    const catFresh = await Category.create({ name: 'Daily Fresh Milk', description: 'Everyday fresh milk sourced directly from local farms.', image: rawMilkImg, isActive: true });
    const catPremium = await Category.create({ name: 'Premium A2 Milk', description: 'High nutrition A2 milk from indigenous Indian cow breeds.', image: premiumMilkImg, isActive: true });

    // Upload product images
    const girCowImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\gir_cow_milk_1786013616923.png');
    const buffaloImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\buffalo_milk_1786013651615.png');
    const fullCreamImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\full_cream_milk_1786022071782.png');
    const sahiwalImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\sahiwal_cow_milk_1786022097937.png');
    const tonedImg = await uploadImage('C:\\Users\\RITESH\\.gemini\\antigravity-ide\\brain\\04f9a160-f5aa-4cee-b34a-08cd411131b3\\toned_milk_pouch_1786022111019.png');

    // Products
    const pGir = await Product.create({
      name: 'Pure A2 Gir Cow Milk',
      description: 'Sweet, highly digestible A2 milk from free-grazing indigenous Gir cows. Rich in calcium and vitamins.',
      category: catPremium._id,
      images: [girCowImg],
      isActive: true,
      variants: [{ unit: '1 Litre', price: 90, stock: 100 }, { unit: '500 ml', price: 46, stock: 100 }]
    });

    const pSahiwal = await Product.create({
      name: 'Organic Sahiwal Cow Milk',
      description: 'Nutrient-dense A2 milk from Sahiwal cows. Known for its distinct sweet taste and high protein content.',
      category: catPremium._id,
      images: [sahiwalImg],
      isActive: true,
      variants: [{ unit: '1 Litre', price: 85, stock: 100 }]
    });

    const pBuffalo = await Product.create({
      name: 'Farm Fresh Buffalo Milk',
      description: 'Thick, high-fat buffalo milk. Yields a thick layer of malai. Perfect for traditional Indian chai and sweets.',
      category: catFresh._id,
      images: [buffaloImg],
      isActive: true,
      variants: [{ unit: '1 Litre', price: 75, stock: 200 }, { unit: '500 ml', price: 38, stock: 200 }]
    });

    const pFullCream = await Product.create({
      name: 'Full Cream Cow Milk',
      description: 'Rich and creamy cow milk with 6% fat. Ideal for growing children and those who love creamy texture.',
      category: catFresh._id,
      images: [fullCreamImg],
      isActive: true,
      variants: [{ unit: '1 Litre', price: 70, stock: 300 }]
    });

    const pToned = await Product.create({
      name: 'Light Toned Milk',
      description: 'Healthy, low-fat toned milk (3% fat). Perfect for daily consumption and maintaining a healthy lifestyle.',
      category: catFresh._id,
      images: [tonedImg],
      isActive: true,
      variants: [{ unit: '1 Litre', price: 54, stock: 400 }]
    });

    // Subscriptions
    await SubscriptionPlan.create({
      name: 'Daily Gir Cow A2 (Monthly)',
      description: 'Get 1 Litre of pure Gir cow milk delivered every morning before 7 AM for 30 days.',
      product: pGir._id,
      productVariantId: pGir.variants[0]._id,
      frequency: 'daily',
      deliveries: 30,
      originalPrice: 2700,
      price: 2550, // Discounted
      image: girCowImg,
      isActive: true
    });

    await SubscriptionPlan.create({
      name: 'Healthy Family Toned Milk',
      description: 'Daily delivery of 1L Light Toned Milk for 30 days. Stay fit and healthy.',
      product: pToned._id,
      productVariantId: pToned.variants[0]._id,
      frequency: 'daily',
      deliveries: 30,
      originalPrice: 1620,
      price: 1550,
      image: tonedImg,
      isActive: true
    });

    await SubscriptionPlan.create({
      name: 'Weekend Buffalo Milk (Thick Malai)',
      description: 'Get 2 Litres of Buffalo milk every Saturday and Sunday for making fresh paneer or thick curd at home. (8 Deliveries)',
      product: pBuffalo._id,
      productVariantId: pBuffalo.variants[0]._id,
      frequency: 'custom',
      deliveries: 8,
      originalPrice: 600,
      price: 580,
      image: buffaloImg,
      isActive: true
    });

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during seed:', err);
    process.exit(1);
  }
};

run();
