# Insert reservations directly to Supabase
$sk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4'
$baseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co/rest/v1/reservations'
$orgId = '54eb6ce7-ba97-4198-8566-6ac075828160'
$userId = '99d34cd5-a593-4362-9846-db7167276592'

$headers = @{
    'apikey' = $sk
    'Authorization' = "Bearer $sk"
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}

# Delete existing
Write-Host "Deleting existing reservations..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$baseUrl`?confirmation_number=in.(7000,7001,7002,7003)" -Method DELETE -Headers @{ apikey = $sk; Authorization = "Bearer $sk" }
    Write-Host "Deleted existing records" -ForegroundColor Green
} catch {
    Write-Host "Delete failed or no records to delete" -ForegroundColor Yellow
}

# Reservations data
$reservations = @(
    @{
        confirmation_number = '7000'
        passenger_name = 'Eric Brustad'
        pickup_address = '401 Chicago Avenue, Minneapolis MN 55415'
        pickup_city = 'Minneapolis'
        pickup_state = 'MN'
        pickup_zip = '55415'
        pickup_datetime = '2026-01-29T20:00:00'
        dropoff_address = 'MSP Airport'
        special_instructions = 'Phone: +17632838336, Flight: 1332'
    },
    @{
        confirmation_number = '7001'
        passenger_name = 'Peter Parker'
        pickup_address = '123 Main St, New York NY 10001'
        pickup_city = 'New York'
        pickup_state = 'NY'
        pickup_datetime = '2026-01-30T10:00:00'
        dropoff_address = 'JFK Airport'
    },
    @{
        confirmation_number = '7002'
        passenger_name = 'Johnny Palmer'
        pickup_address = '456 Oak Ave, Chicago IL 60601'
        pickup_city = 'Chicago'
        pickup_state = 'IL'
        pickup_datetime = '2026-01-31T14:00:00'
        dropoff_address = 'ORD Airport'
    },
    @{
        confirmation_number = '7003'
        passenger_name = 'Blake Edwards'
        pickup_address = '789 Pine St, Los Angeles CA 90001'
        pickup_city = 'Los Angeles'
        pickup_state = 'CA'
        pickup_datetime = '2026-01-29T22:00:00'
        dropoff_address = 'LAX Airport'
    }
)

foreach ($res in $reservations) {
    $data = @{
        organization_id = $orgId
        booked_by_user_id = $userId
        status = 'pending'
        passenger_count = 1
    } + $res
    
    $body = $data | ConvertTo-Json -Compress
    
    try {
        $result = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body $body
        Write-Host "Created $($res.confirmation_number): $($result.passenger_name) - $($result.pickup_address)" -ForegroundColor Green
    } catch {
        Write-Host "Failed $($res.confirmation_number): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Verify
Write-Host "`nVerifying..." -ForegroundColor Cyan
$check = Invoke-RestMethod -Uri "$baseUrl`?select=confirmation_number,passenger_name,pickup_address,organization_id" -Headers @{ apikey = $sk; Authorization = "Bearer $sk" }
$check | Format-Table -AutoSize
