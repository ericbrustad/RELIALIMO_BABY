# Reservation Attachments: Quick Usage

This adds lightweight title→template mapping and per-reservation HTML storage.

Basics
- Track titles: call `registerTitles(["Your Title", "Another Title"])`.
- Save content: call `saveReservationAttachment(resId, title, html)`.
- Open content: call `fetchReservationAttachments(resId)` or `openAttachment(resId, title)`.

Examples
```js
// Register titles once (e.g., on startup)
import { registerTitles } from './HtmlAttachmentService.js';
registerTitles([
  'Passenger Welcome',
  'Driver Notes',
  'Invoice Terms'
]);

// During a reservation action
import { saveReservationAttachment, fetchReservationAttachments } from './api-service.js';
await saveReservationAttachment(reservationId, 'Passenger Welcome', '<h1>Welcome</h1>');
const all = await fetchReservationAttachments(reservationId);
// all: [{ title, content_html, updated_at }, ...]
```

Where templates live
- Mappings point to files under `attachments/templates/{slug}.html`.
- You can edit these HTML files later; they are separate from per-reservation content.

Notes
- Works in localStorage by default; uses Supabase `reservation_attachments` if available.
- Title slugs: lowercase, spaces→`-`, alphanumerics only.
