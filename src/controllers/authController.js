const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otpService');

// Step 1: Register user with mobile/email
exports.signup = async (req, res, next) => {
  try {
    const { username, mobile, email } = req.body;

    // Validate that at least one contact method is provided
    if (!mobile && !email) {
      return res.status(400).json({ error: 'Mobile number or email is required' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if mobile already exists
    if (mobile) {
      const existingMobile = await User.findOne({ mobile });
      if (existingMobile) {
        return res.status(400).json({ error: 'Mobile number already registered' });
      }
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    // Generate OTP
    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    // Create user with OTP
    const user = new User({
      username,
      mobile: mobile || null,
      email: email || null,
      otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // Send OTP
    await otpService.sendOTP(mobile, email, otp);

    res.status(201).json({
      message: 'User registered. Please verify OTP.',
      userId: user._id,
      username: user.username,
      requiresOTP: true
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

    // Find user with OTP
    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    const verification = otpService.verifyOTP(otp, user.otp, user.otpExpiry);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.message });
    }

    // Mark user as verified and clear OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate JWT token
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
    const { mobile, email } = req.body;

    // Validate that at least one contact method is provided
    if (!mobile && !email) {
      return res.status(400).json({ error: 'Mobile number or email is required' });
    }

    // Find user by mobile or email
    const query = {};
    if (mobile) query.mobile = mobile;
    if (email) query.email = email;

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate OTP
    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    // Save OTP to user
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP
    await otpService.sendOTP(user.mobile, user.email, otp);

    res.json({
      message: 'OTP sent successfully',
      userId: user._id,
      username: user.username
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

    // Find user with OTP
    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    const verification = otpService.verifyOTP(otp, user.otp, user.otpExpiry);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.message });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate JWT token
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

    // Generate new OTP
    const otp = otpService.generateOTP();
    const otpExpiry = otpService.getOTPExpiry();

    // Save OTP to user
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP
    await otpService.sendOTP(user.mobile, user.email, otp);

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    next(error);
  }
};
