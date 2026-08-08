import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';

const r=Router();

r.post('/admin-login',async(req,res)=>{const {email,password}=req.body;const u=await User.findOne({email,role:'admin'});if(!u||!await bcrypt.compare(password,u.passwordHash||''))throw new ApiError(401,'Invalid credentials');res.json({success:true,token:signToken({id:u.id,role:u.role}),user:u});});

r.post('/firebase-sync', async (req, res) => {
  const { email, phone, name } = req.body;
  if (!email && !phone) throw new ApiError(400, 'Email or Phone is required from Firebase Auth');
  
  let u = undefined;
  
  // Try to find by email or phone
  if (email) u = await User.findOne({ email });
  if (!u && phone) u = await User.findOne({ phone });

  if (!u) {
    const userData = { 
      email, 
      name: name || 'Customer', 
      role: 'customer', 
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
    if (updated) await u.save();
  }
  
  res.json({ success: true, token: signToken({ id: u.id, role: u.role }), user: u });
});

export default r;
