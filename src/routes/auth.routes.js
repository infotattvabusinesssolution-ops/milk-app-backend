import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';
import { requireAuth } from '../middleware/auth.js';

const r=Router();

r.post('/admin-login',async(req,res)=>{const {email,password}=req.body;const u=await User.findOne({email,role:'admin'});if(!u||!await bcrypt.compare(password,u.passwordHash||''))throw new ApiError(401,'Invalid credentials');res.json({success:true,token:signToken({id:u.id,role:u.role}),user:u});});

r.post('/firebase-sync', async (req, res) => {
  const { email, phone, name, role } = req.body;
  if (!email && !phone) throw new ApiError(400, 'Email or Phone is required from Firebase Auth');
  
  let u = undefined;
  
  // Try to find by email or phone
  if (email) u = await User.findOne({ email });
  if (!u && phone) u = await User.findOne({ phone });

  if (!u) {
    const defaultRole = (role === 'farmer') ? 'farmer' : 'customer';
    const userData = { 
      email, 
      name: name || (defaultRole === 'farmer' ? 'Farmer' : 'Customer'), 
      role: defaultRole, 
      isEmailVerified: !!email 
    };
    if (phone) userData.phone = phone;
    
    u = await User.create(userData);
  } else {
    // Update existing user with new info if provided
    let updated = false;
    if (email && !u.email) { u.email = email; u.isEmailVerified = true; updated = true; }
    if (phone && !u.phone) { u.phone = phone; updated = true; }
    if (name && u.name === 'Customer') { u.name = name; updated = true; }
    if (role === 'farmer' && u.role === 'customer') { u.role = 'farmer'; updated = true; }
    if (updated) await u.save();
  }
  
  res.json({ success: true, token: signToken({ id: u.id, role: u.role }), user: u });
});

r.delete('/account', requireAuth(), async (req, res) => {
  const user = await User.findById(req.auth.id);
  if (!user) throw new ApiError(404, 'User not found');
  
  // Soft delete logic: anonymize personal data to prevent future logins and preserve DB integrity
  const deletedPrefix = `deleted_${Date.now()}_`;
  user.status = 'deleted';
  if (user.email) user.email = `${deletedPrefix}${user.email}`;
  if (user.phone) user.phone = `${deletedPrefix}${user.phone}`;
  user.fcmTokens = [];
  
  await user.save();
  res.json({ success: true, message: 'Account deleted successfully' });
});

export default r;
