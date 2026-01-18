/**
 * Network Broadcast Server
 * Broadcasts messages to all connected devices on the network
 * 
 * Usage: node server.js
 * Then open http://YOUR_IP:3030 in browsers on any device
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// WebSocket server (using built-in approach without external deps)
const PORT = 3030;
const clients = new Set();

// Get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

// Simple WebSocket frame handling
function encodeWebSocketFrame(message) {
    const payload = Buffer.from(message);
    const length = payload.length;
    let frame;
    
    if (length <= 125) {
        frame = Buffer.alloc(2 + length);
        frame[0] = 0x81; // text frame
        frame[1] = length;
        payload.copy(frame, 2);
    } else if (length <= 65535) {
        frame = Buffer.alloc(4 + length);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(length, 2);
        payload.copy(frame, 4);
    } else {
        frame = Buffer.alloc(10 + length);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(length), 2);
        payload.copy(frame, 10);
    }
    return frame;
}

function decodeWebSocketFrame(buffer) {
    if (buffer.length < 2) return null;
    
    const secondByte = buffer[1];
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;
    
    if (payloadLength === 126) {
        if (buffer.length < 4) return null;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
    } else if (payloadLength === 127) {
        if (buffer.length < 10) return null;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }
    
    if (isMasked) {
        if (buffer.length < offset + 4 + payloadLength) return null;
        const mask = buffer.slice(offset, offset + 4);
        offset += 4;
        const payload = buffer.slice(offset, offset + payloadLength);
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
        return payload.toString('utf8');
    }
    
    return buffer.slice(offset, offset + payloadLength).toString('utf8');
}

// Broadcast message to all clients
function broadcast(message, sender = null) {
    const frame = encodeWebSocketFrame(message);
    for (const client of clients) {
        if (client !== sender && client.writable) {
            try {
                client.write(frame);
            } catch (e) {
                clients.delete(client);
            }
        }
    }
}

// HTTP Server
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        const clientPath = path.join(__dirname, 'client.html');
        fs.readFile(clientPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading client');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            clients: clients.size,
            ips: getLocalIPs(),
            port: PORT
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// WebSocket upgrade handling
server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade'] !== 'websocket') {
        socket.destroy();
        return;
    }
    
    // Perform WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    const hash = require('crypto')
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
    
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${hash}`,
        '',
        ''
    ].join('\r\n');
    
    socket.write(responseHeaders);
    clients.add(socket);
    
    const clientIP = req.socket.remoteAddress;
    console.log(`✅ Client connected: ${clientIP} (Total: ${clients.size})`);
    
    // Notify all clients
    broadcast(JSON.stringify({
        type: 'system',
        message: `New device connected (${clients.size} online)`,
        timestamp: new Date().toISOString()
    }));
    
    let buffer = Buffer.alloc(0);
    
    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        
        // Check for close frame
        if (buffer[0] === 0x88) {
            socket.end();
            return;
        }
        
        const message = decodeWebSocketFrame(buffer);
        if (message) {
            buffer = Buffer.alloc(0);
            try {
                const parsed = JSON.parse(message);
                parsed.timestamp = new Date().toISOString();
                console.log(`📨 Message from ${parsed.sender || clientIP}: ${parsed.message}`);
                
                // Broadcast to all including sender
                const frame = encodeWebSocketFrame(JSON.stringify(parsed));
                for (const client of clients) {
                    if (client.writable) {
                        try {
                            client.write(frame);
                        } catch (e) {
                            clients.delete(client);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        }
    });
    
    socket.on('close', () => {
        clients.delete(socket);
        console.log(`❌ Client disconnected: ${clientIP} (Total: ${clients.size})`);
        broadcast(JSON.stringify({
            type: 'system',
            message: `Device disconnected (${clients.size} online)`,
            timestamp: new Date().toISOString()
        }));
    });
    
    socket.on('error', (err) => {
        clients.delete(socket);
        console.error('Socket error:', err.message);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║       🌐 NETWORK BROADCAST SERVER STARTED 🌐          ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║  Port: ${PORT}                                           ║`);
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  Access from any device on your network:              ║');
    
    const ips = getLocalIPs();
    ips.forEach(ip => {
        const url = `http://${ip.address}:${PORT}`;
        const padding = ' '.repeat(Math.max(0, 53 - url.length - ip.name.length - 4));
        console.log(`║  ${ip.name}: ${url}${padding}║`);
    });
    
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  Press Ctrl+C to stop the server                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    broadcast(JSON.stringify({
        type: 'system',
        message: 'Server shutting down...',
        timestamp: new Date().toISOString()
    }));
    
    setTimeout(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    }, 500);
});
