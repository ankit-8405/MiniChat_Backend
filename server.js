require('./src/config/dotenv');
const app = require('./src/app');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketManager = require('./src/sockets/socketManager');

// Check if SSL certificates exist
const sslKeyPath = path.join(__dirname, 'ssl', 'key.pem');
const sslCertPath = path.join(__dirname, 'ssl', 'cert.pem');

let server;

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  // HTTPS Server
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  
  server = https.createServer(options, app);
  console.log('🔒 HTTPS Server enabled');
} else {
  // HTTP Server (fallback)
  server = http.createServer(app);
  console.log('⚠️  HTTP Server (SSL certificates not found)');
  console.log('   To enable HTTPS:');
  console.log('   1. Install mkcert: choco install mkcert');
  console.log('   2. Run: mkcert -install');
  console.log('   3. Run: cd server && mkdir ssl && cd ssl');
  console.log('   4. Run: mkcert localhost 127.0.0.1 ::1 192.168.29.219');
  console.log('   5. Rename files to cert.pem and key.pem');
  console.log('   6. Restart server\n');
}

socketManager.initialize(server);

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (server instanceof https.Server) {
    console.log(`🔒 HTTPS: https://localhost:${PORT}`);
    console.log(`🔒 Network: https://192.168.29.219:${PORT}`);
  } else {
    console.log(`📡 HTTP: http://localhost:${PORT}`);
    console.log(`📡 Network: http://192.168.29.219:${PORT}`);
  }
});
