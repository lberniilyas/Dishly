# Dishly — 3D & AR restaurant menus

Diners scan a QR code on the table, the menu opens in the phone's browser (no app), and any dish can be viewed in 3D and **placed on the real table in augmented reality, at its real size**, before ordering.

| Phase | Scope | Status |
|---|---|---|
| 1 | Diner menu, 3D viewer, AR (iPhone + Android), model pipeline, analytics events, demo data | ✅ done |
| 2 | Owner login, dashboard (restaurant / categories / dishes), photo + 3D model upload with optimization, size slider | next |
| 3 | QR codes (restaurant + per-table PDF), stats dashboard, translations (FR/EN/AR + right-to-left) | later |

Out of scope for now (but planned for): ordering, payments, POS, video → 3D.

---

## Setup

**You need:** Node.js 22 or newer, a free [Supabase](https://supabase.com) account.

### 1. Install

```bash
npm install
```

### 2. Create the Supabase project

On supabase.com → **New project**. Pick the region closest to your restaurants (e.g. *West EU (Paris)*), choose a database password and keep it somewhere safe.

### 3. Create the database

Supabase dashboard → **SQL Editor** → *New query* → paste the whole content of
[`supabase/migrations/20261124120000_init.sql`](supabase/migrations/20261124120000_init.sql) → **Run**.
You should see *"Success. No rows returned"*. This creates the tables, the security rules and the storage buckets.

<details>
<summary>Alternative: Supabase CLI (keeps migrations in sync automatically)</summary>

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # the id in your project URL
npx supabase db push
```
</details>

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill it in (Supabase dashboard → **Project Settings → API Keys**, and the project URL from **Connect** / **Data API**):

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everywhere — `https://<ref>.supabase.co` | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | reading public menus (`sb_publishable_…`, or the legacy *anon* key) | no — protected by Row Level Security |
| `SUPABASE_SECRET_KEY` | seed script + analytics endpoint (`sb_secret_…`, or the legacy *service_role* key) | **yes — server only, never commit it** |

`.env.local` is git-ignored.

### 5. Load the demo restaurant

```bash
npm run samples:fetch   # downloads 4 free 3D food scans (~45 MB, once)
npm run seed            # optimizes them and loads "Le Bistrot Démo" into Supabase
```

The seed runs each scan through the same optimization pipeline that owner uploads will use in phase 2, then uploads the files to Supabase Storage. Re-running it replaces the demo (it never duplicates).

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000/r/bistrot-demo?table=5>.

---

## Testing AR on real phones

AR only works over **HTTPS**. The easiest way to reach your computer from your phone with a real HTTPS certificate is a free Cloudflare tunnel (no account needed, nothing to install on the phone).

1. Install it once (Windows): `winget install --id Cloudflare.cloudflared` (macOS: `brew install cloudflared`), then open a new terminal.
2. Start the app. For realistic speed use a production build:
   ```bash
   npm run build
   npm start
   ```
   (`npm run dev` works through the tunnel too, but it's much slower.)
3. In a second terminal:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   It prints an address like `https://random-words.trycloudflare.com`.
4. Get that address onto your phone: open `https://…trycloudflare.com/r/bistrot-demo/d/d15b0000-0000-4000-8000-0000000000d1` **on your computer** — the desktop version of a dish page shows a QR code. Scan it with the phone's camera.

The 3D files themselves are served by Supabase (already HTTPS), so only the page goes through the tunnel. The tunnel address changes every time you restart `cloudflared`.

### iPhone (AR Quick Look)

Requires an iPhone 6s or newer (ARKit). Use **Safari** (or the camera app's QR scan, which opens Safari). Chrome/Edge/Firefox on iOS also work; in-app browsers (Instagram, WhatsApp…) don't — the page then shows a message asking to open it in Safari.

1. Open the menu with `?table=5` → a **Table 5** chip appears top-right.
2. Tap **Croissant pur beurre**: the photo shows instantly, a thin bar shows loading, then the 3D model fades in. Drag to rotate; swipe vertically to scroll the page.
3. Tap **Voir sur votre table** → AR Quick Look opens. Choose the **AR** tab, move the phone slowly over the table until it detects the surface → the plate appears.
4. Check the real size: the plate is **27 cm** across (the cakes 22.5 and 24.4 cm). Pinch-to-resize is disabled on purpose so the size stays true. Hold a ruler or a real plate next to it.
5. Close Quick Look (✕) — you're back on the page.

### Android (WebXR / Scene Viewer)

Requires a phone with ARCore (*Google Play Services for AR*, [supported devices](https://developers.google.com/ar/devices)). Use **Chrome**.

Tap **Voir sur votre table** → either AR starts inside Chrome (move the phone to find the table, the dish appears on it) or Google's Scene Viewer app opens. Size is locked to real size in both.

### Check the analytics

Supabase dashboard → **Table Editor → events**: you should see `menu_view` (with `table_label = 5`), `dish_view`, `model_loaded` and `ar_launch` (with `ar_mode = quick-look` on iPhone).

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "La réalité augmentée n'est pas disponible…" | In-app browser or unsupported phone → open in Safari / Chrome |
| No **AR** tab in Quick Look, only *Objet* | iPhone without ARKit (older than 6s) |
| Page loads on the phone but not the 3D | Check the phone has internet access to `*.supabase.co` |
| Edited data in Supabase but the menu didn't change | Menus are cached (refreshed hourly). Phase 2's dashboard refreshes instantly; for now restart `npm run dev` / `npm start` |
| `npm run seed` says Supabase is unreachable | Wrong `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` |

---

## Deploying (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add the three environment variables (Project → Settings → Environment Variables).
3. In *Settings → Functions*, pick the region closest to your Supabase project (e.g. `cdg1` Paris).
4. Deploy. The build reads published restaurants from Supabase to pre-render their menus, so run the migration and the seed first.

Every deployment gets an HTTPS URL, so preview deployments are another easy way to test on phones.

> Vercel's free *Hobby* plan doesn't allow commercial use, and Supabase's free plan includes 5 GB/month of file downloads (≈ 2,500 views of a 2 MB model). Plan for the paid tiers when real restaurants go live.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run samples:fetch` | Downloads the demo 3D scans into `seed/sources/` (git-ignored) |
| `npm run seed` | (Re)creates the demo restaurant in Supabase |
| `npm run model:process -- scan.glb --size-cm 26` | Runs the 3D pipeline on any file, writes `out/scan/model.glb`, `model.usdz`, `report.json` — handy to test a scan before uploading |

---

## How it works

### Routes

| URL | Page |
|---|---|
| `/r/[slug]` | Public menu (QR code target). `?table=5` is read in the browser only, so the page stays cacheable |
| `/r/[slug]/d/[dishId]` | Dish: 3D viewer + "Voir sur votre table" |
| `POST /api/track` | Analytics beacons |
| `/` | Minimal home page with a link to the demo |

### Folder structure

```
src/
├─ app/                    routes only (thin): pages + /api/track
├─ features/
│  ├─ menu/                public menu data (cached query), cards, category bar
│  ├─ viewer/              DishViewer — the only code touching <model-viewer>; AR detection
│  ├─ model-pipeline/      3D optimization, plain Node (no Next.js) → can move to a worker
│  │  ├─ steps/            inspect · cleanup · simplify · textures · normalize (real size)
│  │  └─ usdz/             GLB → USDZ converter for iPhone AR
│  ├─ analytics/           event schema, browser tracker, server insert
│  ├─ media/               photo resizing, storage paths & URLs
│  └─ i18n/                languages, French UI text, price formatting
├─ lib/supabase/           public (browser-safe) and admin (server-only) clients
supabase/migrations/       database schema + security rules
seed/                      demo restaurant data + photos
scripts/                   fetch-samples, seed, process-model
public/draco/              decoder for compressed 3D models (served from our own domain)
```

New features get their own folder in `features/` (e.g. `features/ordering/`, `features/video-to-3d/`) without touching the rest.

### The 3D model pipeline

```
raw .glb (scan app today, video→3D later)
   → cleanup     drop cameras/animations/point clouds, merge duplicates, add normals if missing
   → simplify    ≤ 80k triangles (scans are often 500k–2M; the detail lives in the textures)
   → textures    ≤ 2048 px colour / 1024 px other maps, JPEG (PNG only if really transparent)
   → normalize   real size in metres, centred, resting on Y = 0 (on the table, not floating)
   ├→ model.usdz  iPhone AR Quick Look
   └→ model.glb   Draco-compressed geometry: web viewer + Android AR
```

If the result is over budget (5 MB .glb / 8 MB .usdz) it restarts from the raw file with a lighter preset, then warns. Measured: a 29.6 MB, 600k-triangle scan becomes a 1.3 MB .glb in ~8 s; the demo scans go from ~10 MB to ~1.6 MB.

Why these choices:

- **Real size is baked into the files.** On Android, Scene Viewer receives the raw .glb URL; on iPhone, Quick Look opens the .usdz. Neither sees settings made on the web page, so the scale has to be inside the files.
- **JPEG/PNG + Draco, not WebP/KTX2.** The same .glb is read by three different renderers (model-viewer, Scene Viewer, our USDZ export); this is the combination all of them support, and it needs no native binaries (works on Vercel).
- **USDZ generated server-side.** iPhone AR opens instantly from a ready file (no on-device conversion), and it works even before the 3D preview has loaded. If a model has no .usdz, model-viewer converts the .glb on the fly as a fallback. Generated files are checked against Pixar's USD validators during development (0 issues on the demo models).

### Speed

- Menu pages are rendered once and served as static HTML from the cache (no database call per scan); the CSS is inlined in the HTML (saves a round-trip for first-time visitors).
- Photos are resized at upload (480 px card / 1200 px page / 24 px blurred placeholder, WebP).
- The 3D library (~290 KB gzipped) loads only on dish pages — and in the background on the menu once it's idle. The 3D model and its decoder start downloading together with the page.
- Measured locally on a throttled "mid-range phone" (4× slower CPU): menu painted in ~1.4 s on 4G, ~2 s on a pessimistic slow 4G profile.

### Analytics

| Event | Meaning |
|---|---|
| `menu_view` | menu opened (QR scan) |
| `dish_view` | dish page opened |
| `model_loaded` | 3D model displayed |
| `ar_launch` | "Voir sur votre table" tapped. iPhone and Scene Viewer don't report whether AR actually started, so this counts the tap |

Events go to our own `/api/track` (not a third-party script, so ad blockers rarely block it), are sent with `sendBeacon` (still delivered when Safari switches to AR), validated, filtered for bots, and de-duplicated with a per-event id. Each event has a `session_id` (one per visit/tab) so stats can show unique visitors as well as totals.

### Security (Row Level Security)

Anyone can read **published** menus and **ready** models. Owners can only modify their own restaurant (membership table, so staff accounts can be added later). Only the server can write analytics. Storage writes are limited to the restaurant's own folder. These rules were tested against a real Postgres (19 scenarios: other owners, anonymous visitors, duplicates, cascading deletes…).

---

## Known limitations (phase 1)

- No owner dashboard yet: edit data in the Supabase Table Editor, or change `seed/demo-restaurant.ts` and re-run the seed.
- `ar_launch` counts taps on iPhone / Scene Viewer (platform limitation, see above).
- `/api/track` has no per-IP rate limit yet; add one (e.g. Vercel Firewall rules) before selling stats to restaurants.
- The .usdz is written as USDA (text USD, the same format three.js / model-viewer produce). Binary USDC would be ~30 % smaller; possible later.

## Credits

Demo 3D scans from [Poly Haven](https://polyhaven.com), all **CC0** (public domain):
[Croissant](https://polyhaven.com/a/croissant),
[Carved Wooden Plate](https://polyhaven.com/a/carved_wooden_plate),
[Carrot Cake](https://polyhaven.com/a/carrot_cake),
[Strawberry Chocolate Cake](https://polyhaven.com/a/strawberry_chocolate_cake).
Dish photos in `seed/photos/` are renders of these scans.
3D viewer: Google [`<model-viewer>`](https://modelviewer.dev). Model processing: [glTF Transform](https://gltf-transform.dev), [meshoptimizer](https://github.com/zeux/meshoptimizer), [Draco](https://google.github.io/draco/), [sharp](https://sharp.pixelplumbing.com).
