# Sync Supabase Schema
# This script executes the schema SQL file against your Supabase database

$supabaseUrl = "https://siumiadylwcrkaqsfwkj.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "RELIA LIMO - Supabase Schema Sync" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Read the SQL schema file
$sqlFile = "supabase-schema.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: $sqlFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Reading schema file: $sqlFile" -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw

Write-Host "Schema file loaded successfully" -ForegroundColor Green
Write-Host ""

# Note: The Supabase REST API doesn't directly support executing DDL SQL
# You need to use the Supabase Dashboard SQL Editor or PostgreSQL connection

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1 - Supabase Dashboard (RECOMMENDED):" -ForegroundColor Yellow
Write-Host "  1. Open: https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new" -ForegroundColor White
Write-Host "  2. Copy the contents of supabase-schema.sql" -ForegroundColor White
Write-Host "  3. Paste into the SQL Editor" -ForegroundColor White
Write-Host "  4. Click 'RUN' to execute" -ForegroundColor White
Write-Host ""
Write-Host "Option 2 - Direct Database Connection:" -ForegroundColor Yellow
Write-Host "  Run this PowerShell command:" -ForegroundColor White
Write-Host '  psql "postgresql://postgres:[YOUR-PASSWORD]@db.siumiadylwcrkaqsfwkj.supabase.co:5432/postgres" -f supabase-schema.sql' -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3 - Copy SQL to Clipboard:" -ForegroundColor Yellow
Write-Host "  Press any key to copy the schema SQL to your clipboard..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Set-Clipboard -Value $sqlContent
Write-Host "  ✓ Schema SQL copied to clipboard!" -ForegroundColor Green
Write-Host "  Now paste it into the Supabase SQL Editor" -ForegroundColor White
Write-Host ""

# Open Supabase SQL Editor
Write-Host "Opening Supabase SQL Editor in browser..." -ForegroundColor Yellow
Start-Process "https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Schema sync process initiated!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
