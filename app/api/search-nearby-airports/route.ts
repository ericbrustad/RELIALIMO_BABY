import { NextRequest, NextResponse } from 'next/server';

// RapidAPI AeroDataBox for airport search
const AERO_API_KEY = process.env.RAPIDAPI_KEY || '';
const AERO_API_HOST = 'aerodatabox.p.rapidapi.com';

interface Airport {
  code: string;
  name: string;
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  distance?: number;
  type?: string; // airport, fbo, heliport
}

// Calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fallback: Major US airports for when API is not available
const FALLBACK_AIRPORTS: Airport[] = [
  { code: 'MSP', name: 'Minneapolis-St. Paul International Airport', city: 'Minneapolis', state: 'MN', country: 'US', latitude: 44.8848, longitude: -93.2223, type: 'airport' },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', country: 'US', latitude: 41.9742, longitude: -87.9073, type: 'airport' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'US', latitude: 33.9416, longitude: -118.4085, type: 'airport' },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'US', latitude: 40.6413, longitude: -73.7781, type: 'airport' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'US', latitude: 37.6213, longitude: -122.3790, type: 'airport' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', state: 'TX', country: 'US', latitude: 32.8998, longitude: -97.0403, type: 'airport' },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'US', latitude: 39.8561, longitude: -104.6737, type: 'airport' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'US', latitude: 47.4502, longitude: -122.3088, type: 'airport' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'US', latitude: 33.6407, longitude: -84.4277, type: 'airport' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'US', latitude: 25.7959, longitude: -80.2870, type: 'airport' },
  { code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA', country: 'US', latitude: 42.3656, longitude: -71.0096, type: 'airport' },
  { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', country: 'US', latitude: 33.4373, longitude: -112.0078, type: 'airport' },
  { code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', country: 'US', latitude: 36.0840, longitude: -115.1537, type: 'airport' },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'US', latitude: 28.4312, longitude: -81.3081, type: 'airport' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'US', latitude: 40.6895, longitude: -74.1745, type: 'airport' },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'US', latitude: 29.9902, longitude: -95.3368, type: 'airport' },
  { code: 'SAN', name: 'San Diego International Airport', city: 'San Diego', state: 'CA', country: 'US', latitude: 32.7338, longitude: -117.1933, type: 'airport' },
  { code: 'DTW', name: 'Detroit Metropolitan Airport', city: 'Detroit', state: 'MI', country: 'US', latitude: 42.2162, longitude: -83.3554, type: 'airport' },
  { code: 'MSN', name: 'Dane County Regional Airport', city: 'Madison', state: 'WI', country: 'US', latitude: 43.1399, longitude: -89.3375, type: 'airport' },
  { code: 'MKE', name: 'General Mitchell International Airport', city: 'Milwaukee', state: 'WI', country: 'US', latitude: 42.9472, longitude: -87.8966, type: 'airport' },
  { code: 'RST', name: 'Rochester International Airport', city: 'Rochester', state: 'MN', country: 'US', latitude: 43.9083, longitude: -92.5000, type: 'airport' },
  { code: 'FAR', name: 'Hector International Airport', city: 'Fargo', state: 'ND', country: 'US', latitude: 46.9207, longitude: -96.8158, type: 'airport' },
  { code: 'DLH', name: 'Duluth International Airport', city: 'Duluth', state: 'MN', country: 'US', latitude: 46.8420, longitude: -92.1936, type: 'airport' },
  { code: 'STC', name: 'St. Cloud Regional Airport', city: 'St. Cloud', state: 'MN', country: 'US', latitude: 45.5466, longitude: -94.0597, type: 'airport' },
  { code: 'FCM', name: 'Flying Cloud Airport', city: 'Eden Prairie', state: 'MN', country: 'US', latitude: 44.8272, longitude: -93.4572, type: 'airport' },
  { code: 'ANE', name: 'Anoka County-Blaine Airport', city: 'Blaine', state: 'MN', country: 'US', latitude: 45.1450, longitude: -93.2114, type: 'airport' },
  { code: 'STP', name: 'St. Paul Downtown Airport (Holman Field)', city: 'St. Paul', state: 'MN', country: 'US', latitude: 44.9345, longitude: -93.0600, type: 'airport' },
  { code: 'LVN', name: 'Airlake Airport', city: 'Lakeville', state: 'MN', country: 'US', latitude: 44.6279, longitude: -93.2282, type: 'airport' },
  { code: 'MIC', name: 'Crystal Airport', city: 'Crystal', state: 'MN', country: 'US', latitude: 45.0620, longitude: -93.3538, type: 'airport' },
];

// Search nearby airports using AeroDataBox API
async function searchAeroDataBox(lat: number, lng: number, radiusMiles: number): Promise<Airport[]> {
  if (!AERO_API_KEY) {
    console.log('[AirportAPI] No RapidAPI key, using fallback');
    return [];
  }

  const radiusKm = radiusMiles * 1.60934;
  
  try {
    const response = await fetch(
      `https://${AERO_API_HOST}/airports/search/location/${lat}/${lng}/km/${Math.min(radiusKm, 200)}/16`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': AERO_API_KEY,
          'X-RapidAPI-Host': AERO_API_HOST
        }
      }
    );

    if (!response.ok) {
      console.error('[AirportAPI] AeroDataBox error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item: any) => ({
      code: item.icao || item.iata || '',
      name: item.name || '',
      city: item.municipalityName || item.location?.city || '',
      state: item.location?.region || '',
      country: item.countryCode || 'US',
      latitude: item.location?.lat || 0,
      longitude: item.location?.lon || 0,
      distance: calculateDistance(lat, lng, item.location?.lat || 0, item.location?.lon || 0),
      type: item.type?.toLowerCase().includes('heliport') ? 'heliport' : 
            item.type?.toLowerCase().includes('seaplane') ? 'seaplane' : 'airport'
    })).filter((a: Airport) => a.code && a.name);
    
  } catch (error) {
    console.error('[AirportAPI] AeroDataBox fetch error:', error);
    return [];
  }
}

// Search FBOs using Google Places API
async function searchFBOs(lat: number, lng: number, radiusMiles: number): Promise<Airport[]> {
  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!GOOGLE_API_KEY) {
    console.log('[AirportAPI] No Google API key for FBO search');
    return [];
  }

  const radiusMeters = Math.min(radiusMiles * 1609.34, 50000); // Max 50km for Google Places
  
  try {
    // Search for FBOs and private terminals
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=FBO+fixed+base+operator+private+aviation&type=airport&key=${GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      console.error('[AirportAPI] Google Places error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((place: any) => ({
      code: place.place_id?.substring(0, 6).toUpperCase() || '',
      name: place.name || '',
      city: place.vicinity?.split(',')[1]?.trim() || '',
      state: '',
      country: 'US',
      latitude: place.geometry?.location?.lat || 0,
      longitude: place.geometry?.location?.lng || 0,
      distance: calculateDistance(lat, lng, place.geometry?.location?.lat || 0, place.geometry?.location?.lng || 0),
      type: 'fbo'
    })).filter((a: Airport) => a.name);
    
  } catch (error) {
    console.error('[AirportAPI] Google Places fetch error:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const radius = parseFloat(searchParams.get('radius') || '100'); // Default 100 miles
  const includeFBOs = searchParams.get('includeFBOs') === 'true';

  if (!lat || !lng) {
    return NextResponse.json({ 
      error: 'Missing lat/lng parameters',
      airports: [],
      fbos: []
    }, { status: 400 });
  }

  console.log(`[AirportAPI] Searching near ${lat}, ${lng} within ${radius} miles`);

  let airports: Airport[] = [];
  let fbos: Airport[] = [];

  // Try AeroDataBox API first
  airports = await searchAeroDataBox(lat, lng, radius);

  // If no results from API, use fallback list
  if (airports.length === 0) {
    console.log('[AirportAPI] Using fallback airport list');
    airports = FALLBACK_AIRPORTS
      .map(airport => ({
        ...airport,
        distance: calculateDistance(lat, lng, airport.latitude, airport.longitude)
      }))
      .filter(airport => airport.distance <= radius)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  // Optionally search for FBOs
  if (includeFBOs) {
    fbos = await searchFBOs(lat, lng, Math.min(radius, 30)); // Limit FBO search to 30 miles
  }

  // Sort by distance
  airports.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  fbos.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  return NextResponse.json({
    airports: airports.slice(0, 20), // Top 20 airports
    fbos: fbos.slice(0, 10), // Top 10 FBOs
    total: airports.length + fbos.length
  });
}

export async function POST(request: NextRequest) {
  // Support POST for more complex queries
  try {
    const body = await request.json();
    const { lat, lng, radius = 100, includeFBOs = false } = body;

    if (!lat || !lng) {
      return NextResponse.json({ 
        error: 'Missing lat/lng in request body',
        airports: [],
        fbos: []
      }, { status: 400 });
    }

    // Reuse GET logic
    const url = new URL(request.url);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lng', lng.toString());
    url.searchParams.set('radius', radius.toString());
    url.searchParams.set('includeFBOs', includeFBOs.toString());

    const getRequest = new NextRequest(url, { method: 'GET' });
    return GET(getRequest);
    
  } catch (error) {
    console.error('[AirportAPI] POST error:', error);
    return NextResponse.json({ 
      error: 'Invalid request body',
      airports: [],
      fbos: []
    }, { status: 400 });
  }
}
