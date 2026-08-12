export type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

function readSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  if (url.includes("your-project-ref") || publishableKey.includes("your_key")) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }

  return { publishableKey, url };
}

export function isSupabaseConfigured() {
  return readSupabasePublicConfig() !== null;
}

export function getSupabasePublicConfig() {
  const config = readSupabasePublicConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return config;
}
