const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
}).single('avatar');

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { displayName, avatar, bio, statusMessage } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (displayName !== undefined) {
      if (displayName.trim().length < 2 || displayName.trim().length > 50) {
        return res.status(400).json({ error: 'Display name must be between 2 and 50 characters' });
      }
      user.displayName = displayName.trim();
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ error: 'Bio must be less than 200 characters' });
      }
      user.bio = bio;
    }

    if (statusMessage !== undefined) {
      if (statusMessage.length > 100) {
        return res.status(400).json({ error: 'Status message must be less than 100 characters' });
      }
      user.statusMessage = statusMessage;
    }

    // Mark profile as completed
    user.profileCompleted = true;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      statusMessage: user.statusMessage,
      profileCompleted: user.profileCompleted
    });
  } catch (error) {
    next(error);
  }
};

// Upload avatar
exports.uploadAvatar = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size should be less than 5MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the file URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  });
};

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      statusMessage: user.statusMessage,
      profileCompleted: user.profileCompleted,
      createdAt: user.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID (for viewing other users)
exports.getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      statusMessage: user.statusMessage,
      createdAt: user.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// Update status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const userId = req.user.userId;

    const validStatuses = ['online', 'offline', 'busy', 'away'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.status = status;
    await user.save();

    res.json({
      message: 'Status updated successfully',
      status: user.status
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
