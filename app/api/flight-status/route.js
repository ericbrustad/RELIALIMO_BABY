import { NextResponse } from 'next/server';

/**
 * Flight Status API Endpoint
 * Fetches real-time flight status from AeroDataBox or similar provider
 * 
 * Usage: GET /api/flight-status?flight=DL1234
 */

// Cache for flight status (5 minute TTL)
const flightCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const flightNumber = searchParams.get('flight');
    
    if (!flightNumber) {
      return NextResponse.json({ error: 'Flight number required' }, { status: 400 });
    }
    
    // Check cache
    const cacheKey = flightNumber.toUpperCase();
    const cached = flightCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
    
    // Parse flight number (e.g., "DL1234" -> airline: "DL", number: "1234")
    const match = flightNumber.match(/^([A-Z]{2})(\d+)$/i);
    if (!match) {
      return NextResponse.json({ error: 'Invalid flight number format' }, { status: 400 });
    }
    
    const [, airlineCode, flightNum] = match;
    
    // Try AeroDataBox API first
    const apiKey = process.env.AERODATABOX_API_KEY || process.env.RAPIDAPI_KEY;
    
    if (apiKey) {
      try {
        const flightData = await fetchFromAeroDataBox(airlineCode, flightNum, apiKey);
        if (flightData) {
          // Cache the result
          flightCache.set(cacheKey, { data: flightData, timestamp: Date.now() });
          return NextResponse.json(flightData);
        }
      } catch (err) {
        console.error('[FlightStatus] AeroDataBox error:', err);
      }
    }
    
    // Fallback: Return mock data for demo
    const mockData = generateMockFlightStatus(airlineCode, flightNum);
    flightCache.set(cacheKey, { data: mockData, timestamp: Date.now() });
    
    return NextResponse.json(mockData);
  } catch (error) {
    console.error('[FlightStatus] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flight status' }, { status: 500 });
  }
}

/**
 * Fetch flight status from AeroDataBox API
 */
async function fetchFromAeroDataBox(airlineCode, flightNum, apiKey) {
  const today = new Date().toISOString().split('T')[0];
  
  const response = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${airlineCode}${flightNum}/${today}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`AeroDataBox API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data || !data.length) {
    return null;
  }
  
  const flight = data[0]; // Get first (most recent) flight
  
  // Map to our standard format
  return {
    flightNumber: `${airlineCode}${flightNum}`,
    status: mapFlightStatus(flight.status),
    scheduledDeparture: flight.departure?.scheduledTime?.local,
    actualDeparture: flight.departure?.actualTime?.local,
    scheduledArrival: flight.arrival?.scheduledTime?.local,
    estimatedArrival: flight.arrival?.estimatedTime?.local || flight.arrival?.scheduledTime?.local,
    actualArrival: flight.arrival?.actualTime?.local,
    departureAirport: flight.departure?.airport?.iata,
    arrivalAirport: flight.arrival?.airport?.iata,
    terminal: flight.arrival?.terminal,
    gate: flight.arrival?.gate,
    origin: flight.departure?.airport?.name,
    destination: flight.arrival?.airport?.name,
    airline: flight.airline?.name
  };
}

/**
 * Map AeroDataBox status to our simplified status
 */
function mapFlightStatus(status) {
  if (!status) return 'Unknown';
  
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
  if (statusLower.includes('boarding')) {
    return 'Boarding';
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
 * Generate mock flight status for demo purposes
 */
function generateMockFlightStatus(airlineCode, flightNum) {
  // Generate realistic mock data
  const statuses = ['On Time', 'On Time', 'On Time', 'Delayed', 'In Flight', 'Landed'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + (1 + Math.random() * 3) * 60 * 60 * 1000); // 1-4 hours from now
  
  const terminals = ['Terminal 1', 'Terminal 2', 'Lindbergh Terminal', 'Humphrey Terminal'];
  const gates = ['A1', 'B5', 'C12', 'D8', 'E22', 'F15', 'G3'];
  
  return {
    flightNumber: `${airlineCode}${flightNum}`,
    status: randomStatus,
    scheduledArrival: arrivalTime.toISOString(),
    estimatedArrival: randomStatus === 'Delayed' 
      ? new Date(arrivalTime.getTime() + 30 * 60 * 1000).toISOString() 
      : arrivalTime.toISOString(),
    terminal: terminals[Math.floor(Math.random() * terminals.length)],
    gate: gates[Math.floor(Math.random() * gates.length)],
    origin: 'Origin Airport',
    airline: getAirlineName(airlineCode),
    isMock: true // Indicate this is mock data
  };
}

/**
 * Get airline name from code
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
    'G4': 'Allegiant Air'
  };
  
  return airlines[code.toUpperCase()] || `${code} Airlines`;
}
