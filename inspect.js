import mongoose from "mongoose";
import { User } from "./src/models/User.js";
import { Subscription } from "./src/models/Subscription.js";
import { Delivery } from "./src/models/Delivery.js";

mongoose.connect("mongodb://127.0.0.1:27017/milkapp").then(async () => {
  const user = await User.findOne({ email: "dfnokh@gmail.com" });
  if (!user) { console.log("User not found"); process.exit(0); }
  console.log("User ID:", user._id);
  
  const subs = await Subscription.find({ customer: user._id });
  console.log("Subscriptions:", subs.length);
  for (const sub of subs) {
    const deliveryCount = await Delivery.countDocuments({ subscription: sub._id });
    console.log("Sub ID:", sub._id, "Status:", sub.status, "Cycle:", sub.cycle, "Remaining:", sub.remainingDeliveries, "Deliveries:", deliveryCount);
    console.log("Dates - Start:", sub.startDate, "End:", sub.endDate, "Paid Until:", sub.paidUntil);
    if (deliveryCount > 40) {
      console.log("Found bloated subscription, cleaning up deliveries...");
      
      const toDelete = deliveryCount - 30; // monthly subscription has 30 days
      const extraDeliveries = await Delivery.find({ subscription: sub._id }).sort("-deliveryDate").limit(toDelete);
      
      const idsToDelete = extraDeliveries.map(d => d._id);
      await Delivery.deleteMany({ _id: { $in: idsToDelete } });
      
      const newCount = await Delivery.countDocuments({ subscription: sub._id });
      console.log("Cleaned up", toDelete, "deliveries. New count:", newCount);
      
      const lastDelivery = await Delivery.findOne({ subscription: sub._id }).sort("-deliveryDate");
      if (lastDelivery) {
        sub.endDate = lastDelivery.deliveryDate;
        sub.paidUntil = lastDelivery.deliveryDate;
        await sub.save();
        console.log("Fixed subscription dates to match last delivery.");
      }
    }
  }
  process.exit(0);
});
