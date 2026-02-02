const Message = require('../models/Message');
const Channel = require('../models/Channel');
const User = require('../models/User');

// Search messages
exports.searchMessages = async (req, res, next) => {
  try {
    const { channelId, query, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const currentUserId = req.userId;

    // Check if user is channel member
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = channel.members.some(m => m.userId.toString() === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    // Build search query
    const searchQuery = { channelId, parentMessageId: null };

    if (query) {
      searchQuery.text = { $regex: query, $options: 'i' };
    }

    if (userId) {
      searchQuery.sender = userId;
    }

    if (startDate || endDate) {
      searchQuery.timestamp = {};
      if (startDate) searchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) searchQuery.timestamp.$lte = new Date(endDate);
    }

    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('sender', 'username avatar');

    const count = await Message.countDocuments(searchQuery);

    res.json({
      messages,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
