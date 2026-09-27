/// <reference types="vite/client" />

// Names must match supabase/README.md and .env.local (never commit values).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional. Cloudflare Turnstile site key (public); unset = no CAPTCHA widget. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
