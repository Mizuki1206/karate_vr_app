const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
    console.log('Created certs directory');
}

// Certificate configuration
const keyPath = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.cert');

console.log('Generating self-signed certificate for HTTPS...');

try {
    // Generate private key
    execSync(`openssl genrsa -out ${keyPath} 2048`);
    console.log('Generated private key');

    // Generate certificate signing request and certificate
    const subject = '/C=US/ST=State/L=City/O=Organization/CN=localhost';
    execSync(`openssl req -new -x509 -key ${keyPath} -out ${certPath} -days 365 -subj "${subject}"`);
    console.log('Generated certificate');

    console.log('\nCertificate generation complete!');
    console.log(`Private key: ${keyPath}`);
    console.log(`Certificate: ${certPath}`);
    console.log('\nYou can now start the HTTPS server with: npm start');
    console.log('Note: Browsers will show a security warning for self-signed certificates.');
    console.log('You can safely proceed by clicking "Advanced" and "Proceed to localhost".');
} catch (error) {
    console.error('Error generating certificate:', error.message);
    console.error('\nMake sure you have OpenSSL installed on your system.');
    console.error('On macOS: brew install openssl');
    console.error('On Ubuntu/Debian: sudo apt-get install openssl');
    console.error('On Windows: Download from https://www.openssl.org/');
    process.exit(1);
}