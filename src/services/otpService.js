// OTP Service - Console-based for testing, Twilio for production

const crypto = require('node:crypto');
const twilio = require('twilio');

class OTPService {
  twilioClient = null;

  constructor() {
    if (process.env.TWILIO_ACCOUNT_SID && 
        process.env.TWILIO_AUTH_TOKEN && 
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
        process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid') {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  // Generate 6-digit OTP
  generateOTP() {
    // Use crypto.randomBytes for secure random generation
    const buffer = crypto.randomBytes(4);
    const random = buffer.readUInt32BE(0);
    return (random % 900000 + 100000).toString(); // Ensures 6 digits
  }

  // Send OTP via SMS (Twilio) or console
  async sendOTP(mobile, email, otp) {
    try {
      if (mobile && this.twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        // Send SMS via Twilio
        await this.twilioClient.messages.create({
          body: `Your OTP is: ${otp}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: mobile
        });
        console.log(`✅ OTP sent to ${mobile} via SMS`);
        return { success: true, message: 'OTP sent via SMS' };
      } else {
        // Fallback to console
        console.log('\n========================================');
        console.log('🔐 OTP GENERATED');
        console.log('========================================');
        if (mobile) {
          console.log(`📱 Mobile: ${mobile}`);
        }
        if (email) {
          console.log(`📧 Email: ${email}`);
        }
        console.log(`🔢 OTP: ${otp}`);
        console.log(`⏰ Valid for: 10 minutes`);
        console.log('========================================\n');
        return { success: true, message: 'OTP logged to console' };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: 'Failed to send OTP' };
    }
  }

  // Verify OTP
  verifyOTP(userOTP, storedOTP, otpExpiry) {
    // Check if OTP exists
    if (!storedOTP || !otpExpiry) {
      return { valid: false, message: 'OTP not found. Please request a new OTP.' };
    }

    // Check if OTP expired
    if (new Date() > otpExpiry) {
      return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    // Check if OTP matches
    if (userOTP !== storedOTP) {
      return { valid: false, message: 'Invalid OTP. Please try again.' };
    }

    return { valid: true, message: 'OTP verified successfully' };
  }

  // Get OTP expiry time (10 minutes from now)
  getOTPExpiry() {
    return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  }
}

module.exports = new OTPService();
