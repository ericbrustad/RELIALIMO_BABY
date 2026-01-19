# create-driver Edge Function

This is an example Supabase Edge Function (Deno TypeScript) that creates an Auth user using the Service Role key and inserts a corresponding `drivers` row.

Environment variables (set in the Supabase Functions dashboard):
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL

Example request (POST JSON):
{
  "email": "driver@example.com",
  "password": "TempPass123!",
  "first_name": "First",
  "last_name": "Last",
  "phone": "123-456-7890",
  "affiliate_id": "<uuid>"
}

Response will include the created `user` object and the inserted `driver` row (or an error).

Use this function only from server-side code (do not expose the Service Role key to clients).