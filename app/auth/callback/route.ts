import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles the redirect back from Supabase after OAuth (Google) or email
 * magic-link sign-in, exchanging the ?code= for a session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';

  if (code) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
      }
    } catch (err: any) {
      return NextResponse.redirect(
        `${origin}/sign-in?error=${encodeURIComponent(err?.message || 'Authentication failed')}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
