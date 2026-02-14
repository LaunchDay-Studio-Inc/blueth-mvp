'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyOrdersProps {
  goodCode: string;
}

export function MyOrders({ goodCode }: MyOrdersProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">My Orders — {goodCode.replace(/_/g, ' ')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Your open orders will appear here once the order management API is available.
        </p>
      </CardContent>
    </Card>
  );
}
