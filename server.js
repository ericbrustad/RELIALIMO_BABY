const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002; // Changed port to avoid conflicts

// Add basic error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

console.log('🔧 Starting server with Node.js version:', process.version);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Email API endpoint
app.post('/api/email-send', async (req, res) => {
  console.log('📧 Email API called');
  
  try {
    const { to, subject, html, text } = req.body || {};
    
    console.log('📧 Request data:', { to, subject, hasHtml: !!html, hasText: !!text });
    
    if (!to || !subject || (!html && !text)) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: "Missing to/subject/html|text" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    console.log('🔑 Environment check:', { hasApiKey: !!apiKey, hasFrom: !!from });

    if (!apiKey || !from) {
      console.log('⚠️ Missing email credentials in .env');
      return res.status(500).json({ 
        error: "Missing RESEND_API_KEY or EMAIL_FROM in .env file",
        hint: "Edit .env file with your email provider credentials"
      });
    }

    console.log('📤 Sending real email via Resend API...');
    
    // Send real email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Resend API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ Email sent successfully! ID:', data.id);
    return res.status(200).json({ ok: true, id: data.id });

  } catch (e) {
    console.error('❌ Email send error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 ReliaLimo server running on http://localhost:${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/email-send`);
  console.log(`💡 Make sure to create a .env file with RESEND_API_KEY and EMAIL_FROM`);
  console.log(`🔧 Node.js version: ${process.version}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`💡 Port ${PORT} is busy. Try a different port or stop existing server.`);
  }
});