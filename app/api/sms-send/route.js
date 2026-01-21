// Next.js App Router API route for SMS sending via Twilio
import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, PATCH, DELETE, POST, PUT',
      'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    },
  });
}

// Verify Twilio credentials by fetching account info
async function verifyTwilioConnection(accountSid, auth) {
  try {
    const verifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Twilio verification failed:', response.status, errorData);
      return { verified: false, error: errorData.message || `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log('✅ Twilio connection verified:', { 
      accountSid: data.sid, 
      friendlyName: data.friendly_name,
      status: data.status 
    });
    
    // Check if account is active
    if (data.status !== 'active') {
      return { verified: false, error: `Account status: ${data.status}` };
    }
    
    return { verified: true, account: data };
  } catch (error) {
    console.error('❌ Twilio verification error:', error);
    return { verified: false, error: error.message };
  }
}

export async function POST(request) {
  console.log('📱 SMS API called');
  
  try {
    const body = await request.json();
    const { to, body: message } = body;
    
    console.log('📱 SMS request:', { to, hasMessage: !!message });
    
    if (!to || !message) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { error: "Missing 'to' or 'body' field" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { 
          error: "Twilio not configured", 
          hint: "Set TWILIO_ACCOUNT_SID and (TWILIO_AUTH_TOKEN OR TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET) and (TWILIO_MESSAGING_SERVICE_SID OR TWILIO_FROM_NUMBER) in environment variables"
        },
        { status: 500 }
      );
    }

    // Prepare authentication
    let auth;
    if (authToken) {
      auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    } else {
      auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64');
    }

    // Verify Twilio connection before sending
    console.log('🔐 Verifying Twilio connection...');
    const verification = await verifyTwilioConnection(accountSid, auth);
    
    if (!verification.verified) {
      console.error('❌ Twilio connection verification failed:', verification.error);
      return NextResponse.json(
        { 
          error: 'Twilio connection verification failed',
          details: verification.error,
          hint: 'Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct and the account is active'
        },
        { status: 503 }
      );
    }

    // Build Twilio API request
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formBody = new URLSearchParams({
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
      body: formBody.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Twilio error:', data);
      return NextResponse.json(
        { 
          error: 'Failed to send SMS', 
          details: data 
        },
        { status: response.status }
      );
    }

    console.log('✅ SMS sent successfully:', data.sid);
    return NextResponse.json({ 
      success: true, 
      sid: data.sid,
      to: data.to,
      status: data.status
    });

  } catch (error) {
    console.error('❌ SMS sending error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}
