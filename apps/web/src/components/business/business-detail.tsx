'use client';

import {
  useBusinessDetail,
  useBusinessWorkers,
  useProductionJobs,
  useBusinessInventory,
  useRecipes,
} from '@/hooks/use-business';
import { useSubmitAction } from '@/hooks/use-submit-action';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBlueth } from '@blueth/core';
import { Loader2 } from 'lucide-react';

interface BusinessDetailProps {
  businessId: string;
}

export function BusinessDetail({ businessId }: BusinessDetailProps) {
  const { data: business, isLoading: loadingBiz } = useBusinessDetail(businessId);
  const { data: workers } = useBusinessWorkers(businessId);
  const { data: jobs } = useProductionJobs(businessId);
  const { data: inventory } = useBusinessInventory(businessId);
  const { data: recipes } = useRecipes();
  const submitAction = useSubmitAction();

  if (loadingBiz) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!business) {
    return <p className="text-sm text-muted-foreground">Business not found.</p>;
  }

  function startProduction(recipeCode: string) {
    submitAction.mutate({
      type: 'BUSINESS_START_PRODUCTION',
      payload: { businessId, recipeCode },
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{business.name}</CardTitle>
            <Badge variant="secondary">{business.districtCode.replace(/_/g, ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Machinery</span>
            <p className="font-medium">{business.machineryQty}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Satisfaction</span>
            <p className="font-medium">{Math.round(business.satisfaction * 100)}%</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2 mt-3">
          <Card>
            <CardContent className="p-4 text-sm space-y-2">
              <p><span className="text-muted-foreground">Workers:</span> {workers?.length ?? 0}</p>
              <p><span className="text-muted-foreground">Active Jobs:</span> {jobs?.filter((j) => j.status === 'running').length ?? 0}</p>
              <p><span className="text-muted-foreground">Inventory Items:</span> {inventory?.reduce((s, i) => s + i.qty, 0) ?? 0}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers" className="mt-3">
          <Card>
            <CardContent className="p-4">
              {!workers || workers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workers hired</p>
              ) : (
                <div className="space-y-2">
                  {workers.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                      <span>Worker</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{formatBlueth(w.wageCents)}/day</span>
                        <span>{w.hoursPerDay}h/day</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="mt-3 space-y-3">
          {/* Active production jobs */}
          {jobs && jobs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                      <span>{job.recipeCode.replace(/_/g, ' ')}</span>
                      <Badge variant={job.status === 'running' ? 'default' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available recipes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recipes</CardTitle>
            </CardHeader>
            <CardContent>
              {!recipes || recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipes available</p>
              ) : (
                <div className="space-y-2">
                  {recipes.map((r) => (
                    <div key={r.code} className="p-3 border rounded space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{r.name}</span>
                        <Button
                          size="sm"
                          onClick={() => startProduction(r.code)}
                          disabled={submitAction.isPending}
                        >
                          {submitAction.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Start'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Duration: {Math.round(r.durationSeconds / 60)}min | Labor: {r.laborHours}h
                      </p>
                      <div className="flex gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">In: </span>
                          {r.inputs.map((inp) => `${inp.qty}x ${inp.goodCode.replace(/_/g, ' ')}`).join(', ') || 'None'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Out: </span>
                          {r.outputs.map((out) => `${out.qty}x ${out.goodCode.replace(/_/g, ' ')}`).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-3">
          <Card>
            <CardContent className="p-4">
              {!inventory || inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inventory empty</p>
              ) : (
                <div className="space-y-1.5">
                  {inventory.map((item) => (
                    <div key={item.goodCode} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <span>{item.goodCode.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary">{item.qty}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
