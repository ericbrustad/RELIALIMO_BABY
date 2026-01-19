# Verify reservations in Supabase using service role key
$sk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4'
$headers = @{ apikey = $sk; Authorization = "Bearer $sk" }
$url = "https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations?select=confirmation_number,passenger_name,pickup_address,organization_id"

$result = Invoke-RestMethod -Uri $url -Headers $headers

Write-Host "`n=== RESERVATIONS IN SUPABASE ===" -ForegroundColor Green
foreach ($r in $result) {
    Write-Host ""
    Write-Host "Confirmation: $($r.confirmation_number)" -ForegroundColor Cyan
    Write-Host "  Passenger:  $($r.passenger_name)"
    Write-Host "  Pickup:     $($r.pickup_address)"
    Write-Host "  Org ID:     $($r.organization_id)"
}
Write-Host "`nTotal: $($result.Count) reservations" -ForegroundColor Yellow
