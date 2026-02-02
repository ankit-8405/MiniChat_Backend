const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Channel = require('../models/Channel');

// Upload file and create message
router.post('/:channelId', auth, upload.single('file'), async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if user is a member of the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (!channel.members.includes(userId)) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    // Determine message type based on mime type
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      messageType = 'video';
    }

    // Create message with file
    const message = new Message({
      sender: userId,
      channelId,
      text: text || '',
      messageType,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    await message.save();
    await message.populate('sender', 'username');

    // Emit to socket
    const io = require('../sockets/socketManager').getIO();
    io.to(channelId).emit('message:new', message);

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
