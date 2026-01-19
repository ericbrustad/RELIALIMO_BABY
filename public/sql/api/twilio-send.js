export default async function handler(req, res) {
  // Allow POST + handle preflight if needed
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ error: "Missing to/body" });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;            // AC...
    const authToken = process.env.TWILIO_AUTH_TOKEN;              // secret
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // MG...

    if (!accountSid || !authToken || !messagingServiceSid) {
      return res.status(500).json({ error: "Missing Twilio env vars" });
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const params = new URLSearchParams();
    params.set("To", to);
    params.set("Body", body);
    params.set("MessagingServiceSid", messagingServiceSid);

    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    return res.status(200).json({ ok: true, sid: data.sid, status: data.status });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
