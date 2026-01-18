// Flight Verification API
// Uses AeroDataBox or similar flight tracking API

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { flightNumber, date } = req.body;

    if (!flightNumber) {
      return res.status(400).json({ error: 'Flight number is required' });
    }

    // Parse flight number (e.g., "DL1234" -> airline "DL", flight "1234")
    const flightMatch = flightNumber.match(/^([A-Z]{2})(\d+)$/i);
    if (!flightMatch) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Invalid flight number format. Use format: AA1234' 
      });
    }

    const airlineCode = flightMatch[1].toUpperCase();
    const flightNum = flightMatch[2];

    // Check for API key
    const apiKey = process.env.AERODATABOX_API_KEY || process.env.FLIGHT_API_KEY;
    
    if (!apiKey) {
      // Return mock data if no API key configured
      console.log('[FlightVerify] No API key configured, returning mock data');
      return res.status(200).json({
        valid: true,
        airline: getAirlineName(airlineCode),
        flightNumber: flightNumber.toUpperCase(),
        origin: 'Origin Airport',
        destination: 'Destination Airport',
        arrival_time: null,
        status: 'Scheduled',
        note: 'Flight verification service in demo mode'
      });
    }

    // Call flight API (AeroDataBox example)
    const flightDate = date || new Date().toISOString().split('T')[0];
    const apiUrl = `https://aerodatabox.p.rapidapi.com/flights/number/${airlineCode}${flightNum}/${flightDate}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({
          valid: false,
          message: 'Flight not found for the specified date'
        });
      }
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(200).json({
        valid: false,
        message: 'Flight not found'
      });
    }

    // Get the first flight match
    const flight = data[0];
    const arrival = flight.arrival || {};
    const departure = flight.departure || {};

    return res.status(200).json({
      valid: true,
      airline: flight.airline?.name || getAirlineName(airlineCode),
      flightNumber: flightNumber.toUpperCase(),
      origin: departure.airport?.name || departure.airport?.iata || 'N/A',
      destination: arrival.airport?.name || arrival.airport?.iata || 'N/A',
      departure_time: departure.scheduledTimeLocal || departure.scheduledTimeUtc,
      arrival_time: arrival.scheduledTimeLocal || arrival.scheduledTimeUtc,
      status: flight.status || 'Scheduled',
      terminal: arrival.terminal,
      gate: arrival.gate,
      baggage: arrival.baggageBelt
    });

  } catch (error) {
    console.error('[FlightVerify] Error:', error);
    return res.status(500).json({ 
      valid: false,
      error: 'Flight verification service unavailable',
      message: error.message
    });
  }
}

// Helper: Get airline name from code
function getAirlineName(code) {
  const airlines = {
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
    'WN': 'Southwest Airlines',
    'B6': 'JetBlue Airways',
    'AS': 'Alaska Airlines',
    'F9': 'Frontier Airlines',
    'NK': 'Spirit Airlines',
    'G4': 'Allegiant Air',
    'SY': 'Sun Country Airlines',
    'HA': 'Hawaiian Airlines',
    'AC': 'Air Canada',
    'WS': 'WestJet',
    'AM': 'Aeromexico',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM',
    'VS': 'Virgin Atlantic',
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'SQ': 'Singapore Airlines',
    'CX': 'Cathay Pacific',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways'
  };
  return airlines[code] || `${code} Airlines`;
}
