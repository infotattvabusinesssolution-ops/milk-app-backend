import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env' });

const fixAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const hash = await bcrypt.hash('admin123', 10);
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: 'admin@milkmen.com' },
      { $set: { role: 'admin', name: 'System Admin', passwordHash: hash } }
    );
    
    console.log(`Fixed admin user. Modified count: ${result.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixAdmin();
