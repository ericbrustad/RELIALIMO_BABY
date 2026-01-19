// Quick test of Google Places API
// Run with: node test-google-api.mjs

const API_KEY = 'AIzaSyAZhGX8NWGZd4p9OADvlqOgM6eZDwhQQh8';

async function testAutocomplete(searchQuery = 'US Bank Stadium') {
  console.log('Testing Places Autocomplete API with:', searchQuery);
  
  const body = {
    input: searchQuery,
    sessionToken: `session_${Date.now()}`,
    languageCode: 'en'
  };
  
  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'
      },
      body: JSON.stringify(body)
    });
    
    console.log('Response status:', resp.status);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Error:', errorText);
      return null;
    }
    
    const data = await resp.json();
    console.log('Autocomplete response:', JSON.stringify(data, null, 2));
    
    if (data.suggestions && data.suggestions.length > 0) {
      const firstPlaceId = data.suggestions[0].placePrediction?.placeId;
      console.log('First placeId:', firstPlaceId);
      return firstPlaceId;
    }
    
    return null;
  } catch (error) {
    console.error('Autocomplete error:', error);
    return null;
  }
}

async function testPlaceDetails(placeId) {
  console.log('\nTesting Place Details API for:', placeId);
  
  const fields = 'id,displayName,formattedAddress,location,addressComponents';
  
  // Handle different placeId formats
  let resourceName = placeId;
  if (!placeId.startsWith('places/')) {
    resourceName = `places/${placeId}`;
  }
  
  const url = `https://places.googleapis.com/v1/${resourceName}?fields=${fields}`;
  console.log('URL:', url);
  
  try {
    const resp = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY
      }
    });
    
    console.log('Response status:', resp.status);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Error:', errorText);
      return;
    }
    
    const data = await resp.json();
    console.log('Place details:', JSON.stringify(data, null, 2));
    
    console.log('\n=== Parsed Address Components ===');
    if (data.addressComponents) {
      data.addressComponents.forEach(comp => {
        console.log(`  ${comp.types?.join(', ')}: ${comp.longText} (${comp.shortText})`);
      });
    }
  } catch (error) {
    console.error('Place details error:', error);
  }
}

// Run tests
async function main() {
  const placeId = await testAutocomplete();
  
  if (placeId) {
    await testPlaceDetails(placeId);
  }
}

main();
