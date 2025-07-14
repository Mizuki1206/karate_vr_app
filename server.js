const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 全てのネットワークインターフェースでリッスン

app.use(express.static(path.join(__dirname, 'public')));

app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.cert'))
};

https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
  console.log(`HTTPS Server running on https://localhost:${PORT}`);
  console.log(`Also accessible at https://${getLocalIP()}:${PORT}`);
});

// ローカルIPアドレスを取得する関数
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}