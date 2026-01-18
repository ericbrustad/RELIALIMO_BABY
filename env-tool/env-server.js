/**
 * ENV Save & Restore Server
 * Starts a local server and opens the ENV management tool
 * 
 * Usage: node env-server.js
 * Or double-click: START_ENV_TOOL.bat
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3033;
const ROOT = path.join(__dirname, '..');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Create server
const server = http.createServer((req, res) => {
    let filePath;
    
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(__dirname, 'env-manager.html');
    } else if (req.url === '/env.js') {
        filePath = path.join(ROOT, 'env.js');
    } else {
        filePath = path.join(ROOT, req.url);
    }
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// Start server
server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║       🔐 ENV SAVE & RESTORE TOOL STARTED 🔐           ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║  URL: ${url}                              ║`);
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  Press Ctrl+C to stop the server                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    // Open browser
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
        command = `start ${url}`;
    } else if (platform === 'darwin') {
        command = `open ${url}`;
    } else {
        command = `xdg-open ${url}`;
    }
    
    exec(command, (err) => {
        if (err) {
            console.log(`📌 Open this URL in your browser: ${url}`);
        } else {
            console.log('✅ Browser opened automatically');
        }
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server stopped');
    process.exit(0);
});
