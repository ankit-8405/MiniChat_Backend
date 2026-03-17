const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otpService');

// Step 1: Register user with mobile
exports.signup = async (req, res, next) => {
  try {
    const { username, mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    const user = new User({
      username,
      mobile,
      otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    let otpResult;
    try {
      otpResult = await otpService.sendOTP(mobile, otp);
    } catch (otpError) {
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    res.status(201).json({
      message: 'OTP sent successfully. Please verify.',
      userId: user._id,
      username: user.username,
      requiresOTP: true,
      devOTP: otpResult?.devOTP || undefined
    });
  } catch (error) {
    next(error);
  }
};

// Step 2: Verify OTP and complete registration
exports.verifySignupOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and OTP are required' });
    }

    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verification = otpService.verifyOTP(otp, user.otp, user.otpExpiry);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.message });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Registration successful',
      token,
      userId: user._id,
      username: user.username,
      profileCompleted: user.profileCompleted || false,
      requiresProfileSetup: !user.profileCompleted
    });
  } catch (error) {
    next(error);
  }
};

// Step 1: Request OTP for login
exports.requestLoginOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this mobile number' });
    }

    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const otpResult = await otpService.sendOTP(user.mobile, otp);

    res.json({
      message: 'OTP sent successfully',
      userId: user._id,
      username: user.username,
      devOTP: otpResult?.devOTP || undefined
    });
  } catch (error) {
    next(error);
  }
};

// Step 2: Verify OTP and login
exports.verifyLoginOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and OTP are required' });
    }

    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verification = otpService.verifyOTP(otp, user.otp, user.otpExpiry);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.message });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      profileCompleted: user.profileCompleted || false,
      requiresProfileSetup: !user.profileCompleted
    });
  } catch (error) {
    next(error);
  }
};

// Resend OTP
exports.resendOTP = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const otpResult = await otpService.sendOTP(user.mobile, otp);

    res.json({ message: 'OTP resent successfully', devOTP: otpResult?.devOTP || undefined });
  } catch (error) {
    next(error);
  }
};
