# ATX Live — Austin Live Music Map

Light-mode Next.js app for finding live street performers and festivals around Downtown Austin (6th Street, Rainey Street, Red River, and South Congress). The chrome uses the City of Austin flag palette: `#00529C` blue, `#E0144C` red, `#FFE317` gold, and `#FFFFFF` white.

## Features

- Google Photorealistic 3D Tiles via Deck.gl `Tile3DLayer` with early-afternoon daylight lighting (45° pitch, pan / tilt / orbit)
- High-contrast 3D pins that scale with camera zoom (neon green `#10B981` = live, Austin gold `#FFE317` = festivals)
- Search any street or intersection; Nominatim geocodes it and drops a pin
- Genre chips: All, Festivals, Acoustic, Hip-Hop, Rock, Electronic (Austin red when active)
- Festival Finder bottom sheet with stages and set times
- Live pins expire after 2 hours, with a countdown in the performer card
- **Send Tip** shows a success toast
- **Drop Pin / Go Live** modal

## Google 3D Tiles

Copy `.env.example` to `.env.local` and set a Map Tiles API key:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

If the key is missing, the map stays on a bright 2D Austin-flag basemap (no 3D tile requests, no console errors). When Photorealistic 3D Tiles load, the camera keeps a 45° daylight pitch.

## Municipal Data Room

The capture SDK (`src/lib/atx-live-sdk.ts`) indexes any Austin lat/lng — cultural districts when they apply, otherwise zip + neighborhood zones such as `Austin_78749_Slaughter` and `Austin_78758_North_Lamar`. It emits anonymous session, citywide heat, attendance, and physical-only Luminate POS events to `/api/sdk/events`. Super-admins can review aggregates at `/admin/data-room` after signing in at `/admin/login`.

Set a password (8+ characters) and JWT secret (16+ characters):

```bash
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=a-long-random-secret
```

The data room is JWT-cookie protected. It does not change the public map UI.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Geocoding is proxied through `/api/geocode` and `/api/reverse` to Nominatim (OpenStreetMap). Please keep usage light (1 request/second).
