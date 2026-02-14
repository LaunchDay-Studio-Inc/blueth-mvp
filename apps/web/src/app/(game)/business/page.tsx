'use client';

import { useState } from 'react';
import { useBusinesses } from '@/hooks/use-business';
import { BusinessList } from '@/components/business/business-list';
import { RegisterForm } from '@/components/business/register-form';
import { BusinessDetail } from '@/components/business/business-detail';
import { Skeleton } from '@/components/ui/skeleton';

export default function BusinessPage() {
  const { data: businesses, isLoading } = useBusinesses();
  const [selectedId, setSelectedId] = useState<string>('');
  const [showRegister, setShowRegister] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const items = businesses || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Business</h1>
      <p className="text-sm text-muted-foreground">
        Manage your businesses or register a new one.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BusinessList
            businesses={items}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setShowRegister(false); }}
            onRegister={() => { setShowRegister(true); setSelectedId(''); }}
          />
        </div>

        <div className="lg:col-span-2">
          {showRegister ? (
            <RegisterForm onSuccess={(id) => { setSelectedId(id); setShowRegister(false); }} />
          ) : selectedId ? (
            <BusinessDetail businessId={selectedId} />
          ) : (
            <div className="flex items-center justify-center h-64 border rounded-lg text-muted-foreground">
              {items.length === 0 ? 'Register your first business' : 'Select a business'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
