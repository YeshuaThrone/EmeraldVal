# ATX Live — Austin Live Music Map

Dark-mode Next.js app for finding and dropping live street-performer pins around Downtown Austin (6th Street, Rainey Street, and South Congress).

## Features

- Interactive dark map centered on downtown Austin
- Search any street or intersection; Nominatim geocodes it and drops a glowing pin
- Click a marker to open an editable performer drawer (name, location, tip amount, Cash App, Venmo)
- **Send Tip** shows a success toast
- **Drop Pin / Go Live** modal: name, genre, street address, Cash App/Venmo handle
- **Clear All Pins** resets map state

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Geocoding is proxied through `/api/geocode` and `/api/reverse` to Nominatim (OpenStreetMap). Please keep usage light (1 request/second).
