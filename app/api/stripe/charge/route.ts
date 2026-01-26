import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      reservationId, 
      amount, 
      customerId,
      paymentMethodId,
      description,
      metadata 
    } = body;

    if (!reservationId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: reservationId and amount' },
        { status: 400 }
      );
    }

    // Get reservation details
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*, accounts(*)')
      .eq('id', reservationId)
      .single();

    if (resError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Check if customer has a Stripe customer ID
    let stripeCustomerId = reservation.accounts?.stripe_customer_id;
    
    // If no Stripe customer, create one
    if (!stripeCustomerId && reservation.accounts) {
      const customer = await stripe.customers.create({
        email: reservation.accounts.email,
        name: reservation.accounts.company_name || reservation.accounts.name,
        metadata: {
          account_id: reservation.accounts.id,
        }
      });
      stripeCustomerId = customer.id;

      // Save Stripe customer ID to account
      await supabase
        .from('accounts')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', reservation.accounts.id);
    }

    // Create payment intent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: description || `Payment for Reservation #${reservation.confirmation_number}`,
      metadata: {
        reservation_id: reservationId,
        confirmation_number: reservation.confirmation_number,
        ...metadata
      },
    };

    // Attach customer if available
    if (stripeCustomerId) {
      paymentIntentData.customer = stripeCustomerId;
    }

    // If payment method provided, attach and confirm
    if (paymentMethodId) {
      paymentIntentData.payment_method = paymentMethodId;
      paymentIntentData.confirm = true;
      paymentIntentData.return_url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://relialimo.vercel.app'}/settle?success=true`;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // If payment succeeded, update reservation
    if (paymentIntent.status === 'succeeded') {
      await supabase
        .from('reservations')
        .update({ 
          payment_status: 'paid',
          payment_date: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id,
          amount_paid: amount
        })
        .eq('id', reservationId);
    }

    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount / 100,
      }
    });

  } catch (error: any) {
    console.error('[Stripe Charge Error]', error);
    
    // Handle Stripe errors specifically
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}

// Get payment status for a reservation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reservationId = searchParams.get('reservationId');
  const paymentIntentId = searchParams.get('paymentIntentId');

  try {
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return NextResponse.json({
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
      });
    }

    if (reservationId) {
      const { data: reservation } = await supabase
        .from('reservations')
        .select('payment_status, stripe_payment_intent_id, amount_paid')
        .eq('id', reservationId)
        .single();

      return NextResponse.json(reservation);
    }

    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
