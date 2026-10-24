# Brizfit & Activity Tracker (PWA + Docker)

> **Solo Weekend Build**: A phone-first PWA for tracking Brizfit consistency, Saturday Parkrun substitutions, and cardio volume (cycling, running, walking) without form fatigue. Strict **two-tap rule** to log anything.

---

## 🚀 Quick Start (Docker on Home Server)

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
You can set any random host port you like in `.env` (defaults to `7429` to avoid clashing with common ports):
```env
HOST_PORT=7429
POCKET_ID_URL=http://pocket-id:80
VITE_POCKET_ID_URL=https://auth.yourdomain.com
```

### 2. Start with Docker Compose
```bash
docker compose up -d --build
```
Your tracker will be live at `http://<home-server-ip>:7429` (or whatever `HOST_PORT` you pick).

---

## 📱 Installing to Home Screen (PWA)

1. Open `http://<home-server-ip>:3000` in Safari (iOS) or Chrome (Android).
2. Tap **Share** (iOS) or the three-dot menu (Android).
3. Select **"Add to Home Screen"**.
4. Open it from your home screen — it runs in fullscreen standalone mode with full offline capability!

---

## ⚡ The "Two-Tap Rule" & Core Mechanics

- **Weekly Target Slots**: Shows Tuesday, Thursday, and Saturday slots.
  - **1 Tap**: Marks the slot as **Done** with haptic feedback.
  - **Hold (500ms)**: Opens options to flag a **TRT conflict**, swap for **Saturday Parkrun**, or add a note.
- **TRT Rule**: A TRT meeting breaks the streak, but can be made back up by logging an extra Brizfit session on another day of that week.
- **Quick Actions (Below Slots)**:
  - `[+ Make-up Brizfit Today]`: 1 tap logs a make-up session immediately.
  - `[+ Parkrun]`: Tap 1 reveals Bristol venues (`[Ashton Court]`, `[Eastville]`, `[Blaise Castle]`, `[Pomphrey Hill]`), tap 2 selects and logs!
  - `[+ Quick Ride]`: 1 tap logs preset distances (15km, 25km, 35km, 50km).
  - `[+ Run / Walk]`: 1-tap quick presets (5k run, 10k run, 3km walk, 6km walk).
- **Year Heatmap**: Hand-rolled SVG GitHub-style calendar color-coded by activity (Emerald: Brizfit, Amber: Parkrun, Cyan: Cycle, Rose: Run, Mint: Walk, Purple: TRT).
- **Parkrun PBs**: Displays your all-time 5K best and course-specific records with celebratory confetti.
- **Offline First**: All logs are saved instantly to local browser IndexedDB (`Dexie.js`) and synced automatically to SQLite whenever network is available.

---

## 🛠 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run frontend dev server (port 5173)
npm run dev:client

# 3. Run backend Hono server (port 3000)
npm run dev:server
```
