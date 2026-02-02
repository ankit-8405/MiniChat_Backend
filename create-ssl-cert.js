// Simple SSL certificate generator using Node.js forge library
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating self-signed SSL certificate...\n');

try {
  // Try to use forge library
  const forge = require('node-forge');
  const pki = forge.pki;

  // Generate a key pair
  console.log('📝 Generating RSA key pair...');
  const keys = pki.rsa.generateKeyPair(2048);

  // Create a certificate
  console.log('📝 Creating certificate...');
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'IN'
  }, {
    shortName: 'ST',
    value: 'State'
  }, {
    name: 'localityName',
    value: 'City'
  }, {
    name: 'organizationName',
    value: 'Development'
  }, {
    shortName: 'OU',
    value: 'Development'
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
  }, {
    name: 'nsCertType',
    server: true,
    client: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true
  }, {
    name: 'subjectAltName',
    altNames: [{
      type: 2, // DNS
      value: 'localhost'
    }, {
      type: 7, // IP
      ip: '127.0.0.1'
    }, {
      type: 7, // IP
      ip: '192.168.29.219'
    }]
  }]);

  // Self-sign certificate
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Convert to PEM format
  const pemCert = pki.certificateToPem(cert);
  const pemKey = pki.privateKeyToPem(keys.privateKey);

  // Create ssl directory
  const sslDir = path.join(__dirname, 'ssl');
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  // Write files
  fs.writeFileSync(path.join(sslDir, 'cert.pem'), pemCert);
  fs.writeFileSync(path.join(sslDir, 'key.pem'), pemKey);

  console.log('\n✅ SSL Certificate generated successfully!');
  console.log('📁 Location: server/ssl/');
  console.log('   - cert.pem (Certificate)');
  console.log('   - key.pem (Private Key)');
  console.log('\n⚠️  Note: This is a self-signed certificate for development only.');
  console.log('   Your browser will show a security warning:');
  console.log('   1. Click "Advanced"');
  console.log('   2. Click "Proceed to localhost (unsafe)"');
  console.log('\n🚀 Now restart your servers to enable HTTPS!\n');

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('❌ node-forge module not found. Installing...\n');
    console.log('Please run: npm install node-forge');
    console.log('Then run: node create-ssl-cert.js\n');
  } else {
    console.error('❌ Error:', error.message);
  }
}
