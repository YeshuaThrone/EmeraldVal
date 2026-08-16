# ATX Live — Austin Live Music Map

Dark-mode Next.js app for finding live street performers and festivals around Downtown Austin (6th Street, Rainey Street, Red River, and South Congress).

## Features

- Google Photorealistic 3D Tiles via Deck.gl `Tile3DLayer` (pitch + orbit)
- 3D glowing pins that scale with camera zoom (neon green = live, gold = festivals)
- Search any street or intersection; Nominatim geocodes it and drops a pin
- Genre chips: All, Festivals, Acoustic, Hip-Hop, Rock, Electronic
- Festival Finder bottom sheet with stages and set times
- Live pins expire after 2 hours, with a countdown in the performer card
- **Send Tip** shows a success toast
- **Drop Pin / Go Live** modal

## Google 3D Tiles

Copy `.env.example` to `.env.local` and set a Map Tiles API key:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

Without a key, the map still loads a dark 3D-tilted basemap so pins, filters, and timers work.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Geocoding is proxied through `/api/geocode` and `/api/reverse` to Nominatim (OpenStreetMap). Please keep usage light (1 request/second).
