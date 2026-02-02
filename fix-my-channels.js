/**
 * Quick Fix Script - Add yourself to all channels
 * Run this to fix channel membership issues
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('./src/models/Channel');

const fixChannels = async () => {
  try {
    console.log('🔧 Fixing channel memberships...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all channels
    const channels = await Channel.find({});
    console.log(`📊 Found ${channels.length} channels\n`);

    for (const channel of channels) {
      console.log(`\n🔄 Checking channel: "${channel.name}"`);
      console.log(`   Members: ${channel.members.length}`);
      
      // Check if members are in new format
      if (channel.members.length > 0) {
        const firstMember = channel.members[0];
        
        // If first member has userId field, it's already in new format
        if (firstMember.userId) {
          console.log(`   ✅ Already in new format`);
          continue;
        }
        
        // Convert old format to new format
        console.log(`   🔄 Converting to new format...`);
        const newMembers = channel.members.map((userId, index) => ({
          userId: userId,
          role: index === 0 ? 'owner' : 'member',
          joinedAt: channel.createdAt || new Date()
        }));
        
        channel.members = newMembers;
        await channel.save();
        console.log(`   ✅ Converted ${newMembers.length} members`);
      }
    }

    console.log('\n\n✨ All channels fixed!\n');
    await mongoose.connection.close();
    console.log('👋 Done!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixChannels();
