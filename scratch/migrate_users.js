

import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { isApproved: { $ne: true } },
      { $set: { isApproved: true } }
    );
    
    console.log(`Updated ${result.modifiedCount} users to be approved.`);

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

migrate();
