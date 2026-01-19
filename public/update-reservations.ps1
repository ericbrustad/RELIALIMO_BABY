# Update reservations with complete data from localStorage
$sk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4'
$baseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations'
$headers = @{
    'apikey' = $sk
    'Authorization' = "Bearer $sk"
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}

# Reservation 7000 - Eric Brustad (from original localStorage)
$update7000 = @{
    vehicle_type = 'Black Suv'
    trip_type = 'to-airport'
    grand_total = 102.75
    rate_type = 'flat'
    rate_amount = 59
    payment_type = 'account'
    account_id = '76dca894-a77a-461c-9ef7-b5312b924f64'
    pickup_zip = '55415'
    dropoff_datetime = '2026-01-29T20:14:00'
    special_instructions = 'Passenger: Eric Brustad, Phone: +17632838336, Email: eric@erixmn.com, Flight: 1332, Airport: MSP'
    notes = 'Billing: Erix Coach and Car Transportation, Account #30000'
}

Write-Host "Updating 7000..." -ForegroundColor Yellow
try {
    $body = $update7000 | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$baseUrl`?confirmation_number=eq.7000" -Method PATCH -Headers $headers -Body $body | Out-Null
    Write-Host "  7000 updated" -ForegroundColor Green
} catch {
    Write-Host "  7000 failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Reservation 7001 - Peter Parker
$update7001 = @{
    vehicle_type = 'Black Sedan'
    trip_type = 'to-airport'
    grand_total = 85.00
    rate_type = 'flat'
    rate_amount = 85
    payment_type = 'credit_card'
    pickup_zip = '10001'
    special_instructions = 'Passenger: Peter Parker'
}

Write-Host "Updating 7001..." -ForegroundColor Yellow
try {
    $body = $update7001 | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$baseUrl`?confirmation_number=eq.7001" -Method PATCH -Headers $headers -Body $body | Out-Null
    Write-Host "  7001 updated" -ForegroundColor Green
} catch {
    Write-Host "  7001 failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Reservation 7002 - Johnny Palmer
$update7002 = @{
    vehicle_type = 'Black Suv'
    trip_type = 'to-airport'
    grand_total = 95.00
    rate_type = 'flat'
    rate_amount = 95
    payment_type = 'cash'
    pickup_zip = '60601'
    special_instructions = 'Passenger: Johnny Palmer'
}

Write-Host "Updating 7002..." -ForegroundColor Yellow
try {
    $body = $update7002 | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$baseUrl`?confirmation_number=eq.7002" -Method PATCH -Headers $headers -Body $body | Out-Null
    Write-Host "  7002 updated" -ForegroundColor Green
} catch {
    Write-Host "  7002 failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Reservation 7003 - Blake Edwards
$update7003 = @{
    vehicle_type = 'Stretch Limo'
    trip_type = 'to-airport'
    grand_total = 150.00
    rate_type = 'flat'
    rate_amount = 150
    payment_type = 'credit_card'
    pickup_zip = '90001'
    special_instructions = 'Passenger: Blake Edwards'
}

Write-Host "Updating 7003..." -ForegroundColor Yellow
try {
    $body = $update7003 | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$baseUrl`?confirmation_number=eq.7003" -Method PATCH -Headers $headers -Body $body | Out-Null
    Write-Host "  7003 updated" -ForegroundColor Green
} catch {
    Write-Host "  7003 failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Verify updates
Write-Host "`nVerifying updates..." -ForegroundColor Cyan
$result = Invoke-RestMethod -Uri "$baseUrl`?select=confirmation_number,passenger_name,vehicle_type,grand_total,rate_type,payment_type,trip_type" -Headers @{ apikey = $sk; Authorization = "Bearer $sk" }
foreach ($r in $result) {
    Write-Host ""
    Write-Host "Conf# $($r.confirmation_number): $($r.passenger_name)" -ForegroundColor Green
    Write-Host "  Vehicle: $($r.vehicle_type) | Trip: $($r.trip_type)"
    Write-Host "  Total: `$$($r.grand_total) | Rate: $($r.rate_type) | Payment: $($r.payment_type)"
}
