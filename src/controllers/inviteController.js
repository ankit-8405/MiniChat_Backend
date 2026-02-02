const Channel = require('../models/Channel');
const crypto = require('crypto');

// Create invite link
exports.createInviteLink = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { expiryHours, maxUses } = req.body;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user has permission (admin or owner)
    const member = channel.members.find(m => m.userId.toString() === userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only admins can create invite links' });
    }

    // Generate unique code
    const code = crypto.randomBytes(8).toString('hex');

    // Calculate expiry
    let expiresAt = null;
    if (expiryHours) {
      expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }

    const inviteLink = {
      code,
      createdBy: userId,
      expiresAt,
      maxUses: maxUses || null,
      uses: 0
    };

    channel.inviteLinks.push(inviteLink);
    await channel.save();

    res.status(201).json({
      code,
      link: `${process.env.CLIENT_URL}/invite/${code}`,
      expiresAt,
      maxUses
    });
  } catch (error) {
    next(error);
  }
};

// Join via invite link
exports.joinViaInvite = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.userId;

    const channel = await Channel.findOne({ 'inviteLinks.code': code });
    if (!channel) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const invite = channel.inviteLinks.find(inv => inv.code === code);

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite link has expired' });
    }

    // Check max uses
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return res.status(400).json({ error: 'Invite link has reached maximum uses' });
    }

    // Check if already a member
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    if (isMember) {
      return res.status(400).json({ error: 'Already a member of this channel' });
    }

    // Add user to channel
    channel.members.push({
      userId,
      role: 'member'
    });

    // Increment invite uses
    invite.uses += 1;
    await channel.save();

    res.json({
      message: 'Successfully joined channel',
      channel: {
        _id: channel._id,
        name: channel.name,
        description: channel.description
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get channel invite links
exports.getInviteLinks = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId)
      .populate('inviteLinks.createdBy', 'username');

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user has permission
    const member = channel.members.find(m => m.userId.toString() === userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only admins can view invite links' });
    }

    res.json({ inviteLinks: channel.inviteLinks });
  } catch (error) {
    next(error);
  }
};

// Delete invite link
exports.deleteInviteLink = async (req, res, next) => {
  try {
    const { channelId, code } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user has permission
    const member = channel.members.find(m => m.userId.toString() === userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only admins can delete invite links' });
    }

    channel.inviteLinks = channel.inviteLinks.filter(inv => inv.code !== code);
    await channel.save();

    res.json({ message: 'Invite link deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
