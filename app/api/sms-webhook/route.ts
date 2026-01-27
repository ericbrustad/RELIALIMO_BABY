import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// This endpoint receives incoming SMS from Twilio
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Twilio sends these fields
    const from = formData.get('From') as string;        // Driver's phone number
    const body = (formData.get('Body') as string || '').trim().toUpperCase();
    const messageSid = formData.get('MessageSid') as string;
    
    console.log(`📲 Incoming SMS from ${from}: "${body}"`);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Normalize phone number (remove +1 prefix for matching)
    const normalizedPhone = from.replace(/^\+1/, '').replace(/\D/g, '');
    
    // Find the driver by phone number
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, phone')
      .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.eq.${from}`)
      .single();
    
    if (driverError || !driver) {
      console.log(`❌ No driver found for phone: ${from}`);
      return createTwimlResponse("We couldn't find your driver account. Please contact dispatch.");
    }
    
    // Find the most recent pending farmout offer for this driver
    const { data: pendingOffer, error: offerError } = await supabase
      .from('farmout_offers')
      .select('*, reservations(*)')
      .eq('driver_id', driver.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (offerError || !pendingOffer) {
      console.log(`❌ No pending offer found for driver: ${driver.first_name} ${driver.last_name}`);
      return createTwimlResponse("You don't have any pending trip offers. Check the driver portal for details.");
    }
    
    const reservation = pendingOffer.reservations;
    
    // Process Y or N response
    if (body === 'Y' || body === 'YES' || body === 'ACCEPT') {
      // ACCEPT the trip
      console.log(`✅ Driver ${driver.first_name} ACCEPTED reservation ${reservation.confirmation_number}`);
      
      // Update the farmout offer status
      await supabase
        .from('farmout_offers')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', pendingOffer.id);
      
      // Assign the driver to the reservation
      await supabase
        .from('reservations')
        .update({ 
          driver_id: driver.id,
          status: 'assigned',
          farmout_status: 'accepted'
        })
        .eq('id', reservation.id);
      
      // Log the acceptance
      await supabase
        .from('activity_log')
        .insert({
          action: 'farmout_accepted',
          entity_type: 'reservation',
          entity_id: reservation.id,
          details: {
            driver_id: driver.id,
            driver_name: `${driver.first_name} ${driver.last_name}`,
            confirmation_number: reservation.confirmation_number,
            method: 'sms_reply'
          }
        });
      
      return createTwimlResponse(
        `✅ Trip ACCEPTED! You're confirmed for ${reservation.confirmation_number}. ` +
        `Pickup: ${formatDateTime(reservation.pickup_date, reservation.pickup_time)}. ` +
        `Check your driver portal for full details.`
      );
      
    } else if (body === 'N' || body === 'NO' || body === 'DECLINE' || body === 'REJECT') {
      // DECLINE the trip
      console.log(`❌ Driver ${driver.first_name} DECLINED reservation ${reservation.confirmation_number}`);
      
      // Update the farmout offer status
      await supabase
        .from('farmout_offers')
        .update({ 
          status: 'declined',
          responded_at: new Date().toISOString(),
          decline_reason: 'SMS reply: N'
        })
        .eq('id', pendingOffer.id);
      
      // Update reservation farmout status (so system can offer to next driver)
      await supabase
        .from('reservations')
        .update({ 
          farmout_status: 'declined_requeue'
        })
        .eq('id', reservation.id);
      
      // Log the decline
      await supabase
        .from('activity_log')
        .insert({
          action: 'farmout_declined',
          entity_type: 'reservation',
          entity_id: reservation.id,
          details: {
            driver_id: driver.id,
            driver_name: `${driver.first_name} ${driver.last_name}`,
            confirmation_number: reservation.confirmation_number,
            method: 'sms_reply'
          }
        });
      
      return createTwimlResponse(
        `Trip declined. We'll offer it to another driver. ` +
        `Reply STOP to opt out of future offers.`
      );
      
    } else {
      // Unknown response
      console.log(`❓ Unknown response from ${driver.first_name}: "${body}"`);
      return createTwimlResponse(
        `Reply Y to accept or N to decline the trip offer. ` +
        `Or visit your driver portal for details.`
      );
    }
    
  } catch (error) {
    console.error('SMS webhook error:', error);
    return createTwimlResponse("Sorry, there was an error processing your reply. Please try again or contact dispatch.");
  }
}

// Create TwiML response for Twilio
function createTwimlResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
  
  return new NextResponse(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDateTime(date: string, time: string): string {
  try {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    };
    return `${d.toLocaleDateString('en-US', options)} at ${time}`;
  } catch {
    return `${date} at ${time}`;
  }
}
