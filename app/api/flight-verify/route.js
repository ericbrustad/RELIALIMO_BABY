import { NextResponse } from 'next/server';

/**
 * Flight Verification API Endpoint
 * Verifies a flight exists and returns flight details for customer booking
 * 
 * Usage: POST /api/flight-verify
 * Body: { flightNumber: "DL1234", date: "2024-01-25" }
 */

// Cache for flight verification (10 minute TTL)
const verifyCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function POST(request) {
  try {
    const body = await request.json();
    const { flightNumber, date } = body;
    
    if (!flightNumber) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Flight number required' 
      }, { status: 400 });
    }
    
    // Normalize flight number
    const normalizedFlight = flightNumber.toUpperCase().replace(/\s+/g, '');
    
    // Parse flight number (e.g., "DL1234" -> airline: "DL", number: "1234")
    const match = normalizedFlight.match(/^([A-Z]{2})(\d+)$/i);
    if (!match) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid flight number format. Use format: DL1234' 
      });
    }
    
    const [, airlineCode, flightNum] = match;
    
    // Determine the date to use (provided date or today)
    const searchDate = date || new Date().toISOString().split('T')[0];
    
    // Check cache
    const cacheKey = `${normalizedFlight}_${searchDate}`;
    const cached = verifyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[FlightVerify] Returning cached result for:', normalizedFlight);
      return NextResponse.json(cached.data);
    }
    
    // Try AeroDataBox API
    const apiKey = process.env.AERODATABOX_API_KEY || process.env.RAPIDAPI_KEY;
    
    if (apiKey) {
      try {
        const flightData = await fetchFromAeroDataBox(airlineCode, flightNum, searchDate, apiKey);
        if (flightData) {
          const result = {
            valid: true,
            flightNumber: normalizedFlight,
            airline: flightData.airline,
            origin: flightData.origin,
            destination: flightData.destination,
            departure_airport: flightData.departureAirport,
            arrival_airport: flightData.arrivalAirport,
            departure_time: flightData.departureTime,
            arrival_time: flightData.arrivalTime,
            status: flightData.status,
            terminal: flightData.terminal,
            gate: flightData.gate
          };
          
          // Cache the result
          verifyCache.set(cacheKey, { data: result, timestamp: Date.now() });
          console.log('[FlightVerify] Flight verified via AeroDataBox:', normalizedFlight);
          
          return NextResponse.json(result);
        }
      } catch (err) {
        console.error('[FlightVerify] AeroDataBox error:', err.message);
      }
    } else {
      console.warn('[FlightVerify] No API key configured (RAPIDAPI_KEY or AERODATABOX_API_KEY)');
    }
    
    // Flight not found or API error
    // Return a "valid" response for manual entry (don't block booking)
    const fallbackResult = {
      valid: true,
      flightNumber: normalizedFlight,
      airline: getAirlineName(airlineCode),
      origin: null,
      destination: null,
      arrival_time: null,
      status: 'Unverified',
      message: 'Flight details could not be verified automatically. Please ensure details are correct.'
    };
    
    verifyCache.set(cacheKey, { data: fallbackResult, timestamp: Date.now() });
    
    return NextResponse.json(fallbackResult);
    
  } catch (error) {
    console.error('[FlightVerify] Error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Failed to verify flight' 
    }, { status: 500 });
  }
}

/**
 * Fetch flight data from AeroDataBox API
 */
async function fetchFromAeroDataBox(airlineCode, flightNum, date, apiKey) {
  const response = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${airlineCode}${flightNum}/${date}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    }
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Flight not found
    }
    throw new Error(`AeroDataBox API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data || !data.length) {
    return null;
  }
  
  const flight = data[0]; // Get first flight
  
  // Extract arrival time in HH:MM format
  let arrivalTime = null;
  if (flight.arrival?.scheduledTime?.local) {
    // Format: "2024-01-25 14:30+00:00" -> "14:30"
    const timeMatch = flight.arrival.scheduledTime.local.match(/(\d{2}:\d{2})/);
    if (timeMatch) {
      arrivalTime = timeMatch[1];
    }
  }
  
  // Extract departure time in HH:MM format
  let departureTime = null;
  if (flight.departure?.scheduledTime?.local) {
    const timeMatch = flight.departure.scheduledTime.local.match(/(\d{2}:\d{2})/);
    if (timeMatch) {
      departureTime = timeMatch[1];
    }
  }
  
  return {
    flightNumber: `${airlineCode}${flightNum}`,
    airline: flight.airline?.name || getAirlineName(airlineCode),
    origin: flight.departure?.airport?.name,
    destination: flight.arrival?.airport?.name,
    departureAirport: flight.departure?.airport?.iata,
    arrivalAirport: flight.arrival?.airport?.iata,
    departureTime,
    arrivalTime,
    status: mapFlightStatus(flight.status),
    terminal: flight.arrival?.terminal,
    gate: flight.arrival?.gate
  };
}

/**
 * Map AeroDataBox status to simplified status
 */
function mapFlightStatus(status) {
  if (!status) return 'Scheduled';
  
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('landed') || statusLower.includes('arrived')) {
    return 'Landed';
  }
  if (statusLower.includes('delayed')) {
    return 'Delayed';
  }
  if (statusLower.includes('cancelled') || statusLower.includes('canceled')) {
    return 'Cancelled';
  }
  if (statusLower.includes('diverted')) {
    return 'Diverted';
  }
  if (statusLower.includes('departed') || statusLower.includes('en route') || statusLower.includes('airborne')) {
    return 'In Flight';
  }
  if (statusLower.includes('scheduled') || statusLower.includes('on time')) {
    return 'On Time';
  }
  
  return status;
}

/**
 * Get airline name from IATA code
 */
function getAirlineName(code) {
  const airlines = {
    'DL': 'Delta Air Lines',
    'AA': 'American Airlines',
    'UA': 'United Airlines',
    'WN': 'Southwest Airlines',
    'AS': 'Alaska Airlines',
    'B6': 'JetBlue Airways',
    'NK': 'Spirit Airlines',
    'F9': 'Frontier Airlines',
    'SY': 'Sun Country Airlines',
    'G4': 'Allegiant Air',
    'HA': 'Hawaiian Airlines',
    'VX': 'Virgin America',
    'AC': 'Air Canada',
    'AM': 'Aeromexico',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM Royal Dutch Airlines'
  };
  
  return airlines[code.toUpperCase()] || `${code} Airlines`;
}
