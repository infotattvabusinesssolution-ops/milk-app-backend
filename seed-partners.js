import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './src/models/User.js';

dotenv.config({ path: '.env' });

const seedPartners = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const passwordHash = await bcrypt.hash('123', 10);

    const partnersToCreate = [
      { name: 'Delivery Partner 1', email: 'deliver1@gmail.com', phone: '+918888888881', role: 'partner', status: 'active', passwordHash, profilePic: 'https://i.pravatar.cc/150?u=deliver1@gmail.com' },
      { name: 'Delivery Partner 2', email: 'delivery2@gmail.com', phone: '+918888888882', role: 'partner', status: 'active', passwordHash, profilePic: 'https://i.pravatar.cc/150?u=delivery2@gmail.com' },
      { name: 'Delivery Partner 3', email: 'delivery3@gmail.com', phone: '+918888888883', role: 'partner', status: 'active', passwordHash, profilePic: 'https://i.pravatar.cc/150?u=delivery3@gmail.com' },
      { name: 'Delivery Partner 4', email: 'delivery4@gmail.com', phone: '+918888888885', role: 'partner', status: 'active', passwordHash, profilePic: 'https://i.pravatar.cc/150?u=delivery4@gmail.com' },
    ];

    for (const partnerData of partnersToCreate) {
      let partner = await User.findOne({ email: partnerData.email });
      if (!partner) {
        await User.create(partnerData);
        console.log(`Created new partner: ${partnerData.email}`);
      } else {
        partner.role = 'partner';
        partner.passwordHash = passwordHash;
        partner.profilePic = partnerData.profilePic;
        await partner.save();
        console.log(`Updated existing user to partner: ${partnerData.email}`);
      }
    }

    console.log('Successfully created/updated 4 delivery partners.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedPartners();
