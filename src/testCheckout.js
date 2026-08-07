import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { Delivery } from './models/Delivery.js';
import { Subscription } from './models/Subscription.js';
import { Payment } from './models/Payment.js';
import express from 'express';
// We'll just run the logic directly to see what fails
dotenv.config({ path: '.env' });

const testCheckout = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const customer = await User.findOne({ role: 'customer' });
    const product = await Product.findOne();
    
    if (!customer || !product) throw new Error('Need customer and product');
    
    if (customer.addresses.length === 0) {
      customer.addresses.push({ street: '123 Main', city: 'City', zip: '12345' });
      await customer.save();
    }

    const items = [{
      product: product,
      quantity: 1,
      purchaseType: 'onetime',
      price: 100
    }];

    const paymentMethod = 'cod';
    let totalAmount = items[0].price;

    const createdSubscriptions = [];
    for (const item of items) {
      const sub = await Subscription.create({
        customer: customer._id,
        product: item.product._id,
        addressId: customer.addresses[0]._id,
        cycle: 'onetime',
        quantity: item.quantity,
        startDate: new Date(Date.now() + 86400000), // Start tomorrow
        status: 'active'
      });
      createdSubscriptions.push(sub);

      await Delivery.create({
        customer: customer._id,
        subscription: sub._id,
        product: item.product._id,
        deliveryDate: new Date(new Date().setHours(0,0,0,0) + 86400000), // Tomorrow midnight
        quantity: item.quantity,
        payment: sub._id // dummy payment ID for now
      });
    }

    const pay = await Payment.create({
      customer: customer._id,
      subscription: createdSubscriptions[0]._id,
      amount: totalAmount,
      status: 'created'
    });

    await Delivery.updateMany(
      { subscription: { $in: createdSubscriptions.map(s => s._id) } },
      { $set: { payment: pay._id } }
    );

    console.log('Checkout successful');
    process.exit(0);
  } catch (err) {
    console.error('Checkout failed:', err);
    process.exit(1);
  }
};

testCheckout();
