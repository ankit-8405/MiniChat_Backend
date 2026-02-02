const crypto = require('crypto');

// Algorithm for encryption
const ALGORITHM = 'aes-256-gcm';

// Get encryption key from environment (32 bytes for AES-256)
const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('⚠️ ENCRYPTION_KEY not set! Using default (NOT SECURE FOR PRODUCTION)');
    // Default key for development (CHANGE IN PRODUCTION!)
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt text
 * @param {string} text - Plain text to encrypt
 * @returns {object} - Encrypted data with IV and auth tag
 */
exports.encrypt = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  try {
    const iv = crypto.randomBytes(16);
    const key = getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Return original if encryption fails
  }
};

/**
 * Decrypt encrypted data
 * @param {object|string} encryptedData - Encrypted data object or plain text
 * @returns {string} - Decrypted text
 */
exports.decrypt = (encryptedData) => {
  // If it's already plain text or null, return as is
  if (!encryptedData || typeof encryptedData === 'string') {
    return encryptedData;
  }
  
  // If it doesn't have encrypted property, return as is
  if (!encryptedData.encrypted) {
    return encryptedData;
  }
  
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '[Encrypted Message]'; // Return placeholder if decryption fails
  }
};

/**
 * Generate a random encryption key (for setup)
 * @returns {string} - 64 character hex string (32 bytes)
 */
exports.generateKey = () => {
  return crypto.randomBytes(32).toString('hex');
};
