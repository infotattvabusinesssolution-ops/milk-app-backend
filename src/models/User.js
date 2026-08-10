import mongoose from 'mongoose';
const addressSchema=new mongoose.Schema({label:{type:String,default:'Home'},line1:String,line2:String,city:String,state:String,pincode:String,lat:Number,lng:Number,instructions:String},{_id:true});
const schema=new mongoose.Schema({name:{type:String,default:'Customer'},phone:{type:String,unique:true,sparse:true,index:true},email:String,role:{type:String,enum:['customer','partner','admin','farmer'],default:'customer'},passwordHash:String,isEmailVerified:{type:Boolean,default:false},status:{type:String,enum:['active','pending','blocked'],default:'active'},profilePic:String,addresses:[addressSchema],fcmTokens:[String],walletBalance:{type:Number,default:0}},{timestamps:true});
export const User=mongoose.model('User',schema);
