/**
 * Run once: node scripts/addUserTags.js
 * Adds a userTag to any existing users that don't have one.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexus');

const User = (await import('../models/User.js')).default;

const users = await User.find({ userTag: null });
console.log(`Found ${users.length} users without tags`);

for (const user of users) {
  let tag, exists;
  do {
    tag = String(Math.floor(1000 + Math.random() * 9000));
    exists = await User.findOne({ username: user.username, userTag: tag });
  } while (exists);

  user.userTag = tag;
  await user.save();
  console.log(`  ${user.username}#${tag}`);
}

console.log('Done');
await mongoose.disconnect();
