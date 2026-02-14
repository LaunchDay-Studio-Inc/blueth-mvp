import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface Business {
  id: string;
  name: string;
  districtCode: string;
  ownerId: string;
  machineryQty: number;
  satisfaction: number;
  createdAt: string;
}

export interface BusinessWorker {
  id: string;
  businessId: string;
  wageCents: number;
  hoursPerDay: number;
  hiredAt: string;
}

export interface ProductionJob {
  id: string;
  businessId: string;
  recipeCode: string;
  status: string;
  startedAt: string;
  completesAt: string;
}

export interface InventoryItem {
  goodCode: string;
  qty: number;
}

export interface Recipe {
  code: string;
  name: string;
  durationSeconds: number;
  laborHours: number;
  machineryDep: number;
  inputs: Array<{ goodCode: string; qty: number }>;
  outputs: Array<{ goodCode: string; qty: number }>;
}

export function useBusinesses() {
  return useQuery({
    queryKey: queryKeys.business.list(),
    queryFn: () => api.get<Business[]>('/business'),
  });
}

export function useBusinessDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.business.detail(id),
    queryFn: () => api.get<Business>(`/business/${id}`),
    enabled: !!id,
  });
}

export function useBusinessWorkers(id: string) {
  return useQuery({
    queryKey: queryKeys.business.workers(id),
    queryFn: () => api.get<BusinessWorker[]>(`/business/${id}/workers`),
    enabled: !!id,
  });
}

export function useProductionJobs(id: string) {
  return useQuery({
    queryKey: queryKeys.business.jobs(id),
    queryFn: () => api.get<ProductionJob[]>(`/business/${id}/jobs`),
    enabled: !!id,
  });
}

export function useBusinessInventory(id: string) {
  return useQuery({
    queryKey: queryKeys.business.inventory(id),
    queryFn: () => api.get<InventoryItem[]>(`/business/${id}/inventory`),
    enabled: !!id,
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.business.recipes(),
    queryFn: () => api.get<Recipe[]>('/business/recipes'),
  });
}
