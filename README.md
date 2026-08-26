# TableFlow AI

A prototype restaurant booking management system with an AI operational assistant.  
Built with **React**, **Vite**, **TypeScript**, **Supabase**, **Ollama**, and **Recharts** for visualisations.

## Main Features

- Supabase email/password authentication.  
- Per‑user restaurant isolation (each user sees only their own restaurant's data).  
- Booking CRUD with status updates and AI‑handled flag.  
- Dashboard showing live KPIs (today’s bookings, weekly bookings, no‑show rate, AI‑handled enquiries, pending bookings, open escalations).  
- Visual charts: **Booking Status Breakdown** (pie chart) and **7‑Day Booking Trend** (bar chart).  
- Quick‑action buttons for common navigation.  
- Escalation workflow for bookings requiring manual review.  
- Restaurant settings (name, contact, timezone, max party size, opening hours).  
- AI Advisor powered by a local **Ollama** model, with context‑aware prompts and streamed responses.  
- Conversation persistence per user (session storage).  
- Responsive layout for desktop and mobile.  

## Technology Stack

- **React** (v19) with **React Router** for client‑side routing.  
- **Vite** as the bundler / dev server.  
- **TypeScript** for static typing.  
- **Supabase JS** (`@supabase/supabase-js`) for auth and data storage.  
- **Ollama** (local LLM server) accessed via HTTP API.  
- **Recharts** for the dashboard charts.  
- **shadcn/ui** components styled with **Tailwind CSS**.  

## Prerequisites

- **Node.js** (any recent LTS version, e.g., v20).  
- **npm** (comes with Node).  
- A **Supabase** project with the required tables (`profiles`, `restaurants`, `bookings`) and the existing RLS policies (already provided in the migrations).  
- **Ollama** installed locally if you want to use the AI Advisor (optional for basic app usage).  
- At least one Ollama model installed (e.g., `llama3:8b`).  

## Environment Setup

1. **Copy the template**  

   ```bash
   cp .env.example .env
   ```

2. **Fill in the variables**  

   - `VITE_SUPABASE_URL` – your Supabase project URL.  
   - `VITE_SUPABASE_ANON_KEY` – the public anon key from Supabase.  
   - `VITE_OLLAMA_BASE_URL` – leave as `http://localhost:11434` unless Ollama runs elsewhere.  
   - `VITE_OLLAMA_MODEL` – optional; you can select a model from the UI.  

   **Never commit** the `.env` file – it is listed in `.gitignore`.

## Install Dependencies

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

Vite will start (by default on `http://localhost:8080`). Open the printed URL in your browser.

## Production Build

```bash
npm run build
```

The optimized static assets are placed in `dist/`.

## Preview Production Build Locally

```bash
npm run preview
```

## Supabase Requirements

The app expects the following Supabase schema (already created by the migrations):

- **profiles** – stores per‑user profile data.  
- **restaurants** – each authenticated user owns one restaurant; the app creates a default restaurant on first sign‑in.  
- **bookings** – booking records linked to a restaurant via `restaurant_id`.  

RLS policies enforce that a user can only read/write rows belonging to their own `owner_id` / `restaurant_id`. No additional configuration is needed beyond providing the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Ollama Setup (Optional for AI Advisor)

1. Install Ollama from https://ollama.com.  
2. Start the Ollama service (by default it listens on `http://localhost:11434`).  
3. Pull or install at least one model, e.g.:

   ```bash
   ollama pull llama3:8b
   ```

4. The AI Advisor UI will list available models. Choose one or set `VITE_OLLAMA_MODEL` in `.env` to pre‑select.  
5. If Ollama is not running, the AI Advisor page will show an “offline” status and its controls will be disabled.

## Application Routes

| Path               | Page                     | Access |
|--------------------|--------------------------|--------|
| `/login`           | Login & sign‑in           | Public |
| `/dashboard`      | Dashboard (KPIs & charts) | Protected |
| `/bookings`        | List of bookings         | Protected |
| `/bookings/new`    | Create a new booking     | Protected |
| `/settings`        | Restaurant settings      | Protected |
| `/ai-advisor`      | AI Assistant interface   | Protected |
| `/escalations`    | Escalations management   | Protected |
| `*`                | 404 Not Found page       | Protected |

## Demo Flow (quick reproducible test)

1. **Login** with a test Supabase user.  
2. **Dashboard** – verify KPI cards, status chart, trend chart.  
3. Click **“New Booking”**, fill the form, submit – the booking appears in the list.  
4. In **Bookings**, edit a booking’s status via the dropdown – observe KPI updates.  
5. Set a booking’s status to **“Escalated”** – it appears in the **Escalations** page.  
6. In **Escalations**, resolve the booking (change status to Confirmed / Completed / Cancelled).  
7. Open **Settings**, modify restaurant name or opening hours, save – changes persist.  
8. Open **AI Advisor**, click **“Check Connection”** – ensure Ollama is reachable.  
9. Select a model (if not pre‑selected), ask a grounded question (e.g., “How many bookings are pending today?”).  
10. Observe streamed AI response and that the context preview shows correct restaurant data.  
11. Refresh the page – conversation persists, KPI data remains.  
12. **Logout**, then log in with a different test user – each user sees only their own restaurant’s data (KPIs, charts, bookings).  

## Known Limitations

- **Ollama** must be running locally for the AI Advisor; otherwise the feature is disabled.  
- The AI only works with the model you have installed; selecting a non‑existent model shows an error.  
- Booking deletion is not implemented in this prototype.  
- The app assumes the Supabase RLS policies are correctly set; mis‑configuration will result in permission errors.  

## Security Notes

- Only the **public anon key** (`VITE_SUPABASE_ANON_KEY`) is used on the client.  
- **Never** place the Supabase **service‑role key** or any other secret in the frontend or commit it to source control.  
- `.env` files are ignored via `.gitignore`.  
- All data access is protected by Supabase Row‑Level Security, ensuring per‑user isolation.  

---

*End of README.*