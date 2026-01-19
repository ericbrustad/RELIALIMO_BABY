# Test RLS access
$anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw'
$serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4'

Write-Host "=== Testing RLS Access ===" -ForegroundColor Cyan

# Test with anon key
$anonHeaders = @{ apikey = $anonKey; Authorization = "Bearer $anonKey" }
$anonResult = Invoke-RestMethod -Uri "https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations?select=id,confirmation_number&limit=5" -Headers $anonHeaders
Write-Host "Anon key returns: $($anonResult.Count) reservations" -ForegroundColor $(if($anonResult.Count -gt 0) { "Green" } else { "Red" })

# Test with service key
$serviceHeaders = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }
$serviceResult = Invoke-RestMethod -Uri "https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations?select=id,confirmation_number&limit=5" -Headers $serviceHeaders
Write-Host "Service key returns: $($serviceResult.Count) reservations" -ForegroundColor Green

if ($anonResult.Count -eq 0 -and $serviceResult.Count -gt 0) {
    Write-Host "`n!!! RLS IS BLOCKING ANON ACCESS !!!" -ForegroundColor Yellow
    Write-Host "The app uses anon key, so it won't see reservations." -ForegroundColor Yellow
    Write-Host "You need to either:" -ForegroundColor Yellow
    Write-Host "  1. Update RLS policies in Supabase dashboard" -ForegroundColor White
    Write-Host "  2. Or use service role key in the app" -ForegroundColor White
} else {
    Write-Host "`nAnon key has access - app should work!" -ForegroundColor Green
}
