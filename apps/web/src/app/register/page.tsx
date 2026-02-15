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
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
      router.replace('/city');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight neon-text animate-flicker">
            BLUETH CITY
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Pick a name. Build a life.
            <br />
            <span className="text-foreground/60">Every citizen starts from zero.</span>
          </p>
        </div>

        {/* Register Card */}
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
                Choose a handle
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="citizen_name"
                className="bg-background/60 border-border/60 focus:neon-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Secret phrase
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="8+ chars, mixed case + number"
                className="bg-background/60 border-border/60 focus:neon-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
                Confirm phrase
              </Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="repeat it"
                className="bg-background/60 border-border/60 focus:neon-border"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-semibold tracking-wide neon-glow-strong"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Citizen
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already a citizen?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
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
