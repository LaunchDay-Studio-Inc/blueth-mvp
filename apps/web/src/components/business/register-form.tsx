'use client';

import { useState, type FormEvent } from 'react';
import { useSubmitAction } from '@/hooks/use-submit-action';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DISTRICTS } from '@/lib/districts';
import { Loader2 } from 'lucide-react';

interface RegisterFormProps {
  onSuccess: (id: string) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const submitAction = useSubmitAction();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('MARKET_SQ');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    submitAction.mutate(
      {
        type: 'BUSINESS_REGISTER',
        payload: { name: name.trim(), districtCode: district },
      },
      {
        onSuccess: (data) => {
          if (data?.actionId) {
            onSuccess(data.actionId);
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Register Business</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Business Name</Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Business"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="biz-district">District</Label>
            <select
              id="biz-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({d.modifier}x)
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" disabled={submitAction.isPending}>
            {submitAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Register
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
