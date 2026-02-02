const Channel = require('../models/Channel');

exports.createChannel = async (req, res, next) => {
  try {
    const { name, description, isPrivate, password } = req.body;
    const userId = req.userId;

    // Validate: if private, password is required
    if (isPrivate && !password) {
      return res.status(400).json({ error: 'Private channels require a password' });
    }

    const channel = new Channel({
      name,
      description: description || '',
      isPrivate: isPrivate || false,
      password: isPrivate ? password : undefined,
      createdBy: userId,
      members: [{
        userId: userId,
        role: 'owner',
        joinedAt: new Date()
      }]
    });

    await channel.save();
    
    // Return channel without password
    const channelResponse = channel.toObject();
    delete channelResponse.password;
    
    res.status(201).json(channelResponse);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Channel name already exists' });
    }
    next(error);
  }
};

exports.joinChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { password } = req.body;
    const userId = req.userId;

    console.log('Join channel request:', { channelId, userId, hasPassword: !!password });

    const channel = await Channel.findById(channelId).select('+password');
    if (!channel) {
      console.log('Channel not found:', channelId);
      return res.status(404).json({ error: 'Channel not found' });
    }

    console.log('Channel found:', { name: channel.name, isPrivate: channel.isPrivate, membersCount: channel.members.length });

    // Check if already a member
    const isMember = channel.members.some(m => m.userId.toString() === userId.toString());
    if (isMember) {
      console.log('User already a member');
      const channelResponse = channel.toObject();
      delete channelResponse.password;
      return res.json(channelResponse);
    }

    // If private, verify password
    if (channel.isPrivate) {
      if (!password) {
        console.log('Password required but not provided');
        return res.status(401).json({ error: 'Password required for private channel' });
      }
      
      const isPasswordValid = await channel.comparePassword(password);
      if (!isPasswordValid) {
        console.log('Invalid password provided');
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    // Add user to members
    channel.members.push({
      userId: userId,
      role: 'member',
      joinedAt: new Date()
    });
    await channel.save();

    console.log('User successfully joined channel');

    const channelResponse = channel.toObject();
    delete channelResponse.password;
    
    res.json(channelResponse);
  } catch (error) {
    console.error('Error in joinChannel:', error);
    next(error);
  }
};

exports.listChannels = async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let query = {};
    
    // Search by name or ID
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { _id: search.match(/^[0-9a-fA-F]{24}$/) ? search : null }
        ]
      };
    }
    
    const channels = await Channel.find(query)
      .populate('createdBy', 'username')
      .select('name description isPrivate createdBy createdAt members');
    
    res.json(channels);
  } catch (error) {
    next(error);
  }
};

exports.getUserChannels = async (req, res, next) => {
  try {
    const userId = req.userId;
    
    const channels = await Channel.find({ 'members.userId': userId })
      .populate('createdBy', 'username')
      .select('name description isPrivate createdBy createdAt members');
    
    res.json(channels);
  } catch (error) {
    next(error);
  }
};

exports.getChannelDetails = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId)
      .populate('createdBy', 'username avatar')
      .populate('members.userId', 'username avatar status');

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user is a member
    const isMember = channel.members.some(m => m.userId._id.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    const channelResponse = channel.toObject();
    delete channelResponse.password;

    res.json(channelResponse);
  } catch (error) {
    next(error);
  }
};

exports.updateChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { name, description, isPrivate, password } = req.body;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user is owner or admin
    const member = channel.members.find(m => m.userId.toString() === userId.toString());
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Only channel owner or admin can update channel' });
    }

    // Update fields
    if (name) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (isPrivate !== undefined) channel.isPrivate = isPrivate;
    if (password && isPrivate) channel.password = password;

    await channel.save();

    const channelResponse = channel.toObject();
    delete channelResponse.password;

    res.json(channelResponse);
  } catch (error) {
    next(error);
  }
};

exports.deleteChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Only owner can delete
    const member = channel.members.find(m => m.userId.toString() === userId.toString());
    if (!member || member.role !== 'owner') {
      return res.status(403).json({ error: 'Only channel owner can delete channel' });
    }

    await Channel.findByIdAndDelete(channelId);

    // Also delete all messages in this channel
    const Message = require('../models/Message');
    await Message.deleteMany({ channelId });

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.leaveChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user is owner
    const member = channel.members.find(m => m.userId.toString() === userId.toString());
    if (member && member.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot leave channel. Transfer ownership or delete channel.' });
    }

    // Remove user from members
    channel.members = channel.members.filter(m => m.userId.toString() !== userId.toString());
    await channel.save();

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { channelId, userId: targetUserId } = req.params;
    const { role } = req.body;
    const userId = req.userId;

    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be member or admin' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if requester is owner or admin
    const requester = channel.members.find(m => m.userId.toString() === userId.toString());
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return res.status(403).json({ error: 'Only owner or admin can update member roles' });
    }

    // Find target member
    const targetMember = channel.members.find(m => m.userId.toString() === targetUserId.toString());
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot change owner role
    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    targetMember.role = role;
    await channel.save();

    res.json({ message: 'Member role updated successfully', member: targetMember });
  } catch (error) {
    next(error);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const { channelId, userId: targetUserId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if requester is owner or admin
    const requester = channel.members.find(m => m.userId.toString() === userId.toString());
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return res.status(403).json({ error: 'Only owner or admin can remove members' });
    }

    // Find target member
    const targetMember = channel.members.find(m => m.userId.toString() === targetUserId.toString());
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove channel owner' });
    }

    // Remove member
    channel.members = channel.members.filter(m => m.userId.toString() !== targetUserId.toString());
    await channel.save();

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};
