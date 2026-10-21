# Tessera cloud: setup (Supabase, free tier is enough)

1. Create a project at supabase.com.
2. **SQL Editor** -> paste `supabase/schema.sql` -> Run.
3. **Authentication -> Providers -> Email**: keep "Confirm email" ON.
   **Authentication -> URL Configuration**: set Site URL to your site (e.g. `https://you.github.io/tessera/`) and add it to Redirect URLs.
4. Deploy the username login function (Supabase CLI):
   `supabase login && supabase link --project-ref <ref> && supabase functions deploy username-login`
5. Put **Project URL** and **anon public key** (Settings -> API) into `cloud-config.js`.
6. Upload everything to GitHub Pages as before.

Optional: Authentication -> SMTP Settings, add your own mail sender (the built-in one is rate-limited to a few emails per hour).
