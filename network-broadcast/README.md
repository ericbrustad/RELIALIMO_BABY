# 📡 Network Broadcast Messenger

A simple local network messaging system that allows you to send messages to all connected devices on your network.

## Features

- 🌐 **Network-wide broadcasting** - Messages are sent to ALL connected devices
- 📱 **Mobile-friendly** - Works on phones, tablets, and desktops
- 🔔 **Sound notifications** - Audio alerts for incoming messages
- 👤 **Custom device names** - Identify yourself with a custom name
- 🔄 **Auto-reconnect** - Automatically reconnects if connection is lost
- 💾 **No external dependencies** - Pure Node.js, no npm install required

## Quick Start

### 1. Start the Server

```powershell
cd network-broadcast
node server.js
```

### 2. Connect from Any Device

The server will display URLs like:
```
╔═══════════════════════════════════════════════════════╗
║       🌐 NETWORK BROADCAST SERVER STARTED 🌐          ║
╠═══════════════════════════════════════════════════════╣
║  Port: 3030                                           ║
╠═══════════════════════════════════════════════════════╣
║  Access from any device on your network:              ║
║  Ethernet: http://192.168.1.100:3030                  ║
║  Wi-Fi: http://192.168.1.101:3030                     ║
╚═══════════════════════════════════════════════════════╝
```

Open the URL in a browser on any device connected to your network:
- Your computer: `http://localhost:3030`
- Other devices: `http://YOUR_IP:3030`

### 3. Send Messages!

Type a message and click send (or press Enter). The message will appear on ALL connected devices instantly.

## Use Cases

- 📢 Quick announcements to everyone in the office
- 🏠 Family communication across devices at home
- 👥 Team coordination during events
- 🎮 LAN party chat
- 📋 Sharing quick notes between devices

## Settings

Click the ⚙️ gear icon to:
- Set your device name
- Toggle sound notifications
- View connection status
- Manually reconnect

## Firewall Note

If other devices can't connect, you may need to allow Node.js through your firewall:
- Windows: Allow `node.exe` in Windows Firewall
- The server runs on port **3030** by default

## Customization

Edit `server.js` to change the port:
```javascript
const PORT = 3030; // Change to your preferred port
```

## Technical Details

- Uses pure WebSocket protocol (no Socket.io)
- No external npm dependencies
- Runs on Node.js (v12+)
- HTTP server serves the client HTML
- WebSocket handles real-time messaging
