import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Delivery } from '../models/Delivery.js';
import { PartnerProfile } from '../models/PartnerProfile.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { upload } from '../config/cloudinary.js';

const r=Router();r.use(requireAuth('partner'));

r.post('/profile-pic', upload.single('image'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided');
  const user = await User.findByIdAndUpdate(req.auth.id, { $set: { profilePic: req.file.path } }, { new: true });
  res.json({ success: true, data: user });
});

r.get('/profile',async(req,res)=>res.json({success:true,data:await PartnerProfile.findOneAndUpdate({user:req.auth.id},{$setOnInsert:{user:req.auth.id}},{new:true,upsert:true})}));
r.patch('/availability',async(req,res)=>res.json({success:true,data:await PartnerProfile.findOneAndUpdate({user:req.auth.id},{$set:{online:!!req.body.online}},{new:true,upsert:true})}));
r.get('/deliveries',async(req,res)=>{const q=req.query.status?{partner:req.auth.id,status:req.query.status}:{partner:req.auth.id};res.json({success:true,data:await Delivery.find(q).populate('customer product').sort('deliveryDate')});});
r.patch('/deliveries/:id/status',async(req,res)=>{const allowed=['picked_up','out_for_delivery','delivered','failed','rescheduled'];if(!allowed.includes(req.body.status))throw new ApiError(400,'Invalid status');const d=await Delivery.findOne({_id:req.params.id,partner:req.auth.id});if(!d)throw new ApiError(404,'Delivery not found');d.status=req.body.status;d.failureReason=req.body.failureReason;d.proofUrl=req.body.proofUrl;if(d.status==='delivered')d.deliveredAt=new Date();await d.save();res.json({success:true,data:d});});
r.get('/earnings',async(req,res)=>{const delivered=await Delivery.find({partner:req.auth.id,status:'delivered'});res.json({success:true,data:{deliveries:delivered.length,total:delivered.length*10,dailyRatePerDelivery:10}});});
export default r;
