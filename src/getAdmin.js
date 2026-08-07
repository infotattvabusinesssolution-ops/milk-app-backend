import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';

dotenv.config({ path: '.env' });

const getAdminCredentials = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    let admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      admin = await User.create({
        name: 'System Admin',
        email: 'admin@milkmen.com',
        role: 'admin',
        passwordHash,
        status: 'active'
      });
      console.log('Created new Admin account.');
    } else {
      console.log('Admin account exists.');
      // If we don't know the password, let's reset it to admin123
      const passwordHash = await bcrypt.hash('admin123', 10);
      admin.passwordHash = passwordHash;
      await admin.save();
      console.log('Reset admin password to default.');
    }

    console.log('Admin Email:', admin.email);
    console.log('Admin Password: admin123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

getAdminCredentials();
