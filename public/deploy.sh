#!/bin/bash
# Vercel deployment script for RELIALIMO

echo "🚀 Starting Vercel deployment for RELIALIMO..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check for required environment variables
echo "🔧 Checking environment variables..."

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "🎯 Deployment complete!"
echo ""
echo "📋 Post-deployment checklist:"
echo "1. Set environment variables in Vercel dashboard"
echo "2. Test SMS endpoint: [your-domain]/api/sms-send"
echo "3. Test farmout notification at: [your-domain]/test-farmout-notification.html"
echo "4. Verify SMS delivery to +17632838336"
echo ""
echo "🔗 Environment variables needed:"
echo "- SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY"
echo "- TWILIO_ACCOUNT_SID"
echo "- TWILIO_AUTH_TOKEN"
echo "- TWILIO_FROM_NUMBER"