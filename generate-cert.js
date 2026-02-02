// Generate self-signed SSL certificate for local development
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certDir = path.join(__dirname, 'ssl');

// Create ssl directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

console.log('🔐 Generating self-signed SSL certificate...\n');

try {
  // Generate private key and certificate using OpenSSL
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${path.join(certDir, 'key.pem')}" -out "${path.join(certDir, 'cert.pem')}" -days 365 -nodes -subj "/C=IN/ST=State/L=City/O=Organization/CN=localhost"`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('\n✅ SSL Certificate generated successfully!');
  console.log('📁 Location: server/ssl/');
  console.log('   - cert.pem (Certificate)');
  console.log('   - key.pem (Private Key)');
  console.log('\n⚠️  Note: This is a self-signed certificate for development only.');
  console.log('   Your browser will show a security warning - click "Advanced" and "Proceed".\n');
} catch (error) {
  console.error('❌ Error generating certificate:', error.message);
  console.log('\n📝 Alternative: Use mkcert (easier method)');
  console.log('   1. Install mkcert: https://github.com/FiloSottile/mkcert');
  console.log('   2. Run: mkcert -install');
  console.log('   3. Run: mkcert localhost 127.0.0.1 ::1 192.168.29.219');
  console.log('   4. Move generated files to server/ssl/\n');
}
