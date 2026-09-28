// Harness stub: no Supabase client is ever created.
export const isSupabaseConfigured = false;
export function getSupabase() {
  return { removeChannel() {} } as unknown as never;
}
