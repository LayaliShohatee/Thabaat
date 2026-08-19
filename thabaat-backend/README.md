# Thabaat Backend

Node.js + Express backend for the Thabaat Community Platform.

## Setup

1. Install dependencies:
   npm install

2. Create your .env file (copy the format from .env in this folder):
   PORT=3000
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_KEY=your-service-role-key

3. Run in development mode:
   npm run dev

4. Test the backend is running:
   GET http://localhost:3000/health

## Available Scripts

- npm run dev    — runs with nodemon (auto-restarts on file changes)
- npm run build  — compiles TypeScript to dist/
- npm start      — runs compiled output from dist/

## Structure

src/
  index.ts          — Express app entry point
  routes/
    notify.ts       — POST /notify — push notification dispatch (Jenna)
  middleware/
    auth.ts         — JWT verification middleware
  lib/
    supabaseAdmin.ts — Supabase client with service role key