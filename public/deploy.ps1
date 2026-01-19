# Vercel deployment script for RELIALIMO (Windows PowerShell)

Write-Host "🚀 Starting Vercel deployment for RELIALIMO..." -ForegroundColor Green

# Check if Vercel CLI is installed
try {
    vercel --version | Out-Null
    Write-Host "✅ Vercel CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Check for required files
Write-Host "🔧 Checking deployment files..." -ForegroundColor Blue

if (Test-Path "vercel.json") {
    Write-Host "✅ vercel.json found" -ForegroundColor Green
} else {
    Write-Host "❌ vercel.json missing" -ForegroundColor Red
    exit 1
}

if (Test-Path "package.json") {
    Write-Host "✅ package.json found" -ForegroundColor Green
} else {
    Write-Host "❌ package.json missing" -ForegroundColor Red
    exit 1
}

if (Test-Path "api/sms-send.js") {
    Write-Host "✅ SMS endpoint found" -ForegroundColor Green
} else {
    Write-Host "❌ SMS endpoint missing at api/sms-send.js" -ForegroundColor Red
    exit 1
}

# Deploy to Vercel
Write-Host "📦 Deploying to Vercel..." -ForegroundColor Blue
vercel --prod

Write-Host ""
Write-Host "🎯 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Post-deployment checklist:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in Vercel dashboard" -ForegroundColor White
Write-Host "2. Test SMS endpoint: [your-domain]/api/sms-send" -ForegroundColor White
Write-Host "3. Test farmout notification at: [your-domain]/test-farmout-notification.html" -ForegroundColor White
Write-Host "4. Verify SMS delivery to +17632838336" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Environment variables needed in Vercel:" -ForegroundColor Yellow
Write-Host "- SUPABASE_URL" -ForegroundColor Cyan
Write-Host "- SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Cyan
Write-Host "- TWILIO_ACCOUNT_SID" -ForegroundColor Cyan
Write-Host "- TWILIO_AUTH_TOKEN" -ForegroundColor Cyan
Write-Host "- TWILIO_FROM_NUMBER" -ForegroundColor Cyan