const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authValidation } = require('../middleware/validation');

// OTP-based authentication routes
router.post('/signup', authValidation.signup, authController.signup);
router.post('/verify-signup-otp', authController.verifySignupOTP);
router.post('/request-login-otp', authController.requestLoginOTP);
router.post('/verify-login-otp', authController.verifyLoginOTP);
router.post('/resend-otp', authController.resendOTP);

module.exports = router;
