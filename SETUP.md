# Upcycle Inventory — Setup Guide

## 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire contents of `supabase/schema.sql`
   - This creates all tables, triggers, RLS policies, storage bucket, and seed data
3. Copy your project credentials from **Settings → API**

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## 3. Supabase Auth — create the shared account

In Supabase → **Authentication → Users**, click "Invite user" or use the SQL editor:

```sql
-- Run in SQL Editor (uses Supabase's built-in auth helper)
SELECT supabase_auth.create_user('org@university.edu', 'your-password');
```

Or simply sign up via the app's login page — the first visit before auth is set up.

## 4. Run locally

```bash
npm install
npm run dev
```

App runs at http://localhost:3000 (auto-redirects to /items after login).

## 5. Deploy

```bash
npm run build   # verify build succeeds
```

Deploy to Vercel, Netlify, or any Node host. Add the two env vars in your host's dashboard.

---

## Feature summary

| Tab        | What it does |
|------------|-------------|
| **Items**  | Searchable inventory list, filter by category, tap for stock history + photo upload |
| **Categories** | Table of categories with item counts, tap to filter Items tab |
| **Logs**   | Movement log table (sortable, filterable by date/group), + FAB opens log form, CSV export |
| **Groups** | Cards showing items taken/given per student organisation |

## Schema notes

- Stock is **automatically updated** by a Postgres trigger when a log is inserted — no manual update needed.
- Images upload to a public `items` bucket in Supabase Storage.
- All tables have RLS enabled; authenticated users have full access.
