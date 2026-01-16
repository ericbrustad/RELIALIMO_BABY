// Vercel serverless function for SMS sending
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📱 SMS API called on Vercel');
  
  try {
    const { to, message } = req.body || {};
    
    console.log('📱 SMS request:', { to, hasMessage: !!message });
    
    if (!to || !message) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: "Missing 'to' or 'message' field" });
    }

    // Get Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    
    console.log('🔑 Twilio env check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasApiKey: !!apiKeySid,
      hasApiKeySecret: !!apiKeySecret,
      hasMessagingService: !!messagingServiceSid,
      hasFromNumber: !!fromNumber
    });

    // Check if we have the minimum required credentials
    if (!accountSid || (!authToken && (!apiKeySid || !apiKeySecret)) || (!messagingServiceSid && !fromNumber)) {
      console.log('⚠️ Missing Twilio credentials');
      return res.status(500).json({ 
        error: "Twilio not configured", 
        hint: "Set TWILIO_ACCOUNT_SID and (TWILIO_AUTH_TOKEN OR TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET) and (TWILIO_MESSAGING_SERVICE_SID OR TWILIO_FROM_NUMBER) in environment variables"
      });
    }

    // Prepare authentication
    let auth;
    if (authToken) {
      auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    } else {
      auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64');
    }

    // Build Twilio API request
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const body = new URLSearchParams({
      To: to,
      Body: message,
      ...(messagingServiceSid 
        ? { MessagingServiceSid: messagingServiceSid }
        : { From: fromNumber }
      )
    });

    console.log('📡 Sending to Twilio API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Twilio error:', data);
      return res.status(response.status).json({ 
        error: 'Failed to send SMS', 
        details: data 
      });
    }

    console.log('✅ SMS sent successfully:', data.sid);
    return res.status(200).json({ 
      success: true, 
      sid: data.sid,
      to: data.to,
      status: data.status
    });

  } catch (error) {
    console.error('❌ SMS sending error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}