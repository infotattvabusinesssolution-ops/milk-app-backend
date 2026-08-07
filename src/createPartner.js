import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';

dotenv.config({ path: '.env' });

const seedPartner = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    let partner = await User.findOne({ email: 'partner@milkmen.com' });
    if (!partner) {
      partner = await User.create({
        name: 'Raju Delivery',
        email: 'partner@milkmen.com',
        phone: '+919999999999',
        role: 'partner',
        status: 'active'
      });
      console.log('Created new partner user');
    } else {
      partner.role = 'partner';
      await partner.save();
      console.log('Updated existing user to partner role');
    }

    console.log('Partner email: partner@milkmen.com');
    console.log('(Since we are in mock auth mode, any password will work on the login screen for this email)');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedPartner();
