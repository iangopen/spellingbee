// Harness stub: pretend a guest session already exists. No sign-in happens.
export interface SupabaseUserState {
  userId: string | null;
  ready: boolean;
  error: string | null;
}
export function useSupabaseUser(): SupabaseUserState {
  return { userId: "me", ready: true, error: null };
}
