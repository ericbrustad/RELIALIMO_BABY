export default async function handler(req, res) {
  // Add CORS headers for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};
    const { to, subject, html, text, emailType } = body;
    
    // Validate required fields
    if (!to) {
      return res.status(400).json({ error: "Missing 'to' email address" });
    }
    if (!subject) {
      return res.status(400).json({ error: "Missing 'subject'" });
    }
    if (!html && !text) {
      return res.status(400).json({ error: "Missing 'html' or 'text' content" });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: "Invalid 'to' email format" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || 'dispatch@relialimo.com';

    if (!apiKey) {
      console.error('[email-send] Missing RESEND_API_KEY');
      return res.status(500).json({ 
        error: "Email service not configured",
        hint: "Configure RESEND_API_KEY in Vercel dashboard"
      });
    }

    console.log(`[email-send] Sending email to: ${to}, subject: ${subject}, type: ${emailType || 'general'}`);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        from, 
        to: Array.isArray(to) ? to : [to], 
        subject, 
        html: html || undefined, 
        text: text || undefined 
      }),
    });

    const data = await r.json();
    
    if (!r.ok) {
      console.error('[email-send] Resend API error:', data);
      return res.status(r.status).json({ 
        error: data.message || 'Failed to send email',
        details: data 
      });
    }

    console.log(`[email-send] Email sent successfully, id: ${data.id}`);
    
    // Optionally log to outbound_emails table here
    // This would require Supabase client setup
    
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('[email-send] Exception:', e);
    return res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Internal server error'
    });
  }
}