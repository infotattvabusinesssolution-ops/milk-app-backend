const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  const db = mongoose.connection;
  const productsCol = db.db.collection('products');
  
  // Mapping of exact names (or substrings) to image paths
  // Try to update them
  await productsCol.updateOne(
    { name: { $regex: /Malai Dar Buffalo/i } },
    { $set: { images: ['/products/malai-dar-buffalo-milk.png'], imageUrl: '/products/malai-dar-buffalo-milk.png' } }
  );
  await productsCol.updateOne(
    { name: { $regex: /Murrah Buffalo Milk/i } },
    { $set: { images: ['/products/murrah-buffalo-milk.png'], imageUrl: '/products/murrah-buffalo-milk.png' } }
  );
  await productsCol.updateOne(
    { name: { $regex: /Shudh Desi Cow Milk/i } },
    { $set: { images: ['/products/shudh-desi-cow-milk.png'], imageUrl: '/products/shudh-desi-cow-milk.png' } }
  );
  await productsCol.updateOne(
    { name: { $regex: /Gir A2 Cow Milk/i } },
    { $set: { images: ['/products/gir-a2-cow-milk.png'], imageUrl: '/products/gir-a2-cow-milk.png' } }
  );

  console.log('Update complete');
  
  const docs = await productsCol.find({}).toArray();
  console.log(docs.map(d => `${d.name}: ${d.images}`));
  process.exit(0);
}).catch(console.error);
