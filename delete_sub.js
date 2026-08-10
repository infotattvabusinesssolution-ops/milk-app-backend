import mongoose from "mongoose";
import { User } from "./src/models/User.js";
import { Subscription } from "./src/models/Subscription.js";
import { Delivery } from "./src/models/Delivery.js";

mongoose.connect("mongodb://127.0.0.1:27017/milkapp").then(async () => {
  try {
    const user = await User.findOne({ email: "dfnokh@gmail.com" });
    if (!user) { console.log("User not found"); process.exit(0); }
    console.log("User ID:", user._id);
    
    const subs = await Subscription.find({ customer: user._id });
    console.log(`Found ${subs.length} subscriptions for this user.`);
    
    for (const sub of subs) {
      console.log(`Deleting subscription ${sub._id}...`);
      
      // Delete all deliveries associated with this subscription
      const delResult = await Delivery.deleteMany({ subscription: sub._id });
      console.log(`Deleted ${delResult.deletedCount} deliveries for subscription ${sub._id}.`);
      
      // Delete the subscription itself
      await Subscription.deleteOne({ _id: sub._id });
      console.log(`Successfully deleted subscription ${sub._id}.`);
    }
    
    console.log("Deletion process completed.");
  } catch (error) {
    console.error("Error during deletion:", error);
  } finally {
    process.exit(0);
  }
}).catch(err => {
  console.error("Failed to connect to MongoDB:", err.message);
  process.exit(1);
});
