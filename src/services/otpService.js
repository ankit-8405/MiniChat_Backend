// OTP Service - SMS via Twilio

const crypto = require('node:crypto');

let twilioClient = null;

// ─── Twilio (SMS) ─────────────────────────────────────────────────────────────
try {
  const twilio = require('twilio');
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')
  ) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio SMS client initialized');
  } else {
    console.warn('⚠️  Twilio credentials missing or invalid in .env');
  }
} catch (e) {
  console.warn('⚠️  Twilio not available:', e.message);
}

const isDev = process.env.NODE_ENV !== 'production';

class OTPService {
  // ─── Generate 6-digit OTP ────────────────────────────────────────────────────
  generateOTP() {
    const buffer = crypto.randomBytes(4);
    const random = buffer.readUInt32BE(0);
    return (random % 900000 + 100000).toString();
  }

  // ─── Get OTP expiry time (10 minutes from now) ────────────────────────────
  getOTPExpiry() {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  // ─── Send OTP via Twilio SMS ──────────────────────────────────────────────
  async sendOTP(mobile, otp) {
    const toNumber = mobile.startsWith('+') ? mobile : `+91${mobile}`;

    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
      // No Twilio configured — dev console fallback only
      if (isDev) {
        console.log('\n' + '='.repeat(50));
        console.log('🔐  OTP (Console Mode — Twilio not configured)');
        console.log(`📱 Mobile : ${toNumber}`);
        console.log(`🔢 OTP    : ${otp}`);
        console.log('='.repeat(50) + '\n');
        return { success: true, devOTP: otp };
      }
      throw new Error('SMS service is not configured');
    }

    try {
      await twilioClient.messages.create({
        body: `MiniChat: Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
      console.log(`✅ OTP SMS sent to ${toNumber}`);
      return { success: true, message: 'OTP sent via SMS' };
    } catch (err) {
      console.error(`❌ Twilio SMS failed for ${toNumber}:`, err.message);

      // In dev — fall back to console so testing is never blocked
      if (isDev) {
        console.log('\n' + '='.repeat(50));
        console.log('🔐  OTP (Dev fallback — Twilio error)');
        console.log(`📱 Mobile : ${toNumber}`);
        console.log(`🔢 OTP    : ${otp}`);
        console.log(`⚠️  Reason : ${err.message}`);
        console.log('='.repeat(50) + '\n');
        return { success: true, devOTP: otp };
      }

      // In production — surface a user-friendly error
      if (err.code === 21608) {
        throw new Error('This number is not verified with our SMS provider. Please contact support.');
      }
      throw new Error('Failed to send OTP via SMS. Please try again.');
    }
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  verifyOTP(userOTP, storedOTP, otpExpiry) {
    if (!storedOTP || !otpExpiry) {
      return { valid: false, message: 'OTP not found. Please request a new OTP.' };
    }
    if (new Date() > new Date(otpExpiry)) {
      return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
    }
    if (userOTP.toString().trim() !== storedOTP.toString().trim()) {
      return { valid: false, message: 'Invalid OTP. Please try again.' };
    }
    return { valid: true, message: 'OTP verified successfully' };
  }
}

module.exports = new OTPService();
