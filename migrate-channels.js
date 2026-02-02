/**
 * Migration Script for Channel Schema Update
 * 
 * This script migrates existing channels from simple member array
 * to role-based member structure.
 * 
 * Run: node migrate-channels.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('./src/models/Channel');

const migrateChannels = async () => {
  try {
    console.log('🚀 Starting channel migration...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all channels
    const channels = await Channel.find({});
    console.log(`📊 Found ${channels.length} channels to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const channel of channels) {
      // Check if already migrated (members have role property)
      if (channel.members.length > 0 && channel.members[0].role) {
        console.log(`⏭️  Skipping "${channel.name}" - already migrated`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 Migrating channel: "${channel.name}"`);

      // Store old members
      const oldMembers = [...channel.members];

      // Convert to new format
      const newMembers = oldMembers.map((userId, index) => ({
        userId: userId,
        role: index === 0 ? 'owner' : 'member', // First member is owner
        joinedAt: channel.createdAt || new Date()
      }));

      // Update channel
      channel.members = newMembers;
      channel.inviteLinks = channel.inviteLinks || [];

      await channel.save();
      
      console.log(`  ✅ Migrated ${oldMembers.length} members`);
      console.log(`  👑 Owner: ${newMembers[0].userId}`);
      console.log(`  👥 Members: ${newMembers.length - 1}\n`);

      migratedCount++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount} channels`);
    console.log(`  ⏭️  Skipped: ${skippedCount} channels`);
    console.log(`  📦 Total: ${channels.length} channels\n`);

    console.log('✨ Migration completed successfully!\n');

    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateChannels();
