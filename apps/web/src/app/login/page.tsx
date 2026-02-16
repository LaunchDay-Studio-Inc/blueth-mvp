'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CitySkyline } from '@/components/city-skyline';
import { Loader2, UserCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, guestLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.replace('/city');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    try {
      await guestLogin();
      router.replace('/city');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not enter as guest. Try again.');
      }
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden skyline-gradient">
      {/* Skyline background */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none">
        <CitySkyline className="w-full h-auto opacity-60" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight neon-text">
            BLUETH CITY
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
            The city never sleeps. Hustle, eat, rest, repeat.
            <br />
            <span className="text-foreground/60">Your story starts now.</span>
          </p>
        </div>

        {/* Login Card */}
        <div
          className="w-full max-w-sm rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-6 shadow-xl animate-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase tracking-wider text-muted-foreground">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="your handle"
                className="bg-background/60 border-border/60 focus:neon-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="secret phrase"
                className="bg-background/60 border-border/60 focus:neon-border"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-semibold tracking-wide neon-glow-strong"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* Guest entry */}
          <Button
            variant="outline"
            className="w-full border-border/50 text-muted-foreground hover:text-foreground hover:neon-border"
            onClick={handleGuest}
            disabled={guestLoading}
          >
            {guestLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserCircle2 className="h-4 w-4 mr-2" />
            )}
            Enter as Guest
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            New citizen?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>

        {/* Flavor footer */}
        <p
          className="mt-6 text-[11px] text-muted-foreground/50 tracking-wider animate-fade-in"
          style={{ animationDelay: '0.6s' }}
        >
          v0.1 &middot; a life sim experiment
        </p>
      </div>
    </div>
  );
}
