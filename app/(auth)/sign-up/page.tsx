'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();
  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!configured) {
      setError(
        'Supabase credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (signUpError) {
        // Detect common network/fetch errors caused by invalid domain
        if (signUpError.message?.toLowerCase().includes('failed to fetch')) {
          setError(
            'Unable to reach Supabase. Please verify NEXT_PUBLIC_SUPABASE_URL in your .env.local file.'
          );
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      // If Supabase has email confirmation disabled, a session is immediately established
      if (data?.session) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      // If user already exists, identities is often empty to prevent email harvesting
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err: any) {
      setError(
        err?.message?.includes('fetch')
          ? 'Network error: could not connect to Supabase. Check your internet connection and .env.local credentials.'
          : err?.message || 'An unexpected error occurred during sign up.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    if (!configured) {
      setError(
        'Supabase credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
      );
      return;
    }

    setOauthLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred with Google Sign In');
      setOauthLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Check your email</h2>
          <p className="mb-6 text-sm text-slate-600 leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click the link in your email to
            activate your account and access your workspace.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/sign-in"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Go to sign in <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Didn't receive it or entered wrong email? Click here
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mb-6 text-sm text-slate-500">Get started with your collaborative workspace</p>

        {!configured && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">Supabase is not connected yet</p>
              <p className="text-amber-700 leading-relaxed">
                Authentication requires Supabase. Copy{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.local.example</code>{' '}
                to <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.local</code> and
                fill in your <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={oauthLoading || loading}
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {oauthLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{oauthLoading ? 'Redirecting…' : 'Continue with Google'}</span>
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          OR
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Full name</label>
            <input
              type="text"
              required
              placeholder="Vinayak Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Email address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href={redirectTo !== '/dashboard' ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}` : '/sign-in'}
            className="font-medium text-slate-900 underline hover:text-slate-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

