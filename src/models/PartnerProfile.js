import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true},online:{type:Boolean,default:false},vehicleType:String,vehicleNumber:String,kycStatus:{type:String,enum:['pending','approved','rejected'],default:'pending'},bank:{accountHolder:String,accountNumber:String,ifsc:String,bankName:String},servicePincodes:[String],earningsBalance:{type:Number,default:0}},{timestamps:true});
export const PartnerProfile=mongoose.model('PartnerProfile',schema);
