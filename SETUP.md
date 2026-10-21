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

## Google Maps (map cards)

Map cards use Google Maps. You need your own API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project and turn on billing (Google's monthly free credit normally covers personal use).
2. Enable **Maps JavaScript API**, **Geocoding API** and **Maps Static API**.
3. Create an API key under *APIs & Services → Credentials*. Restrict it: *Application restrictions → Websites*, add your site address (for example `https://yourname.github.io/*`), and under *API restrictions* allow just those three APIs.
4. Paste the key into `cloud-config.js` (`window.TESSERA_MAPS_KEY`), or leave it empty and paste it inside the map editor.

Shared links carry the key so viewers see the same map, which is why the website restriction matters.
