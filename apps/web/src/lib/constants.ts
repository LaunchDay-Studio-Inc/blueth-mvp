import type { VigorKey, MealQuality } from '@blueth/core';

export const VIGOR_LABELS: Record<VigorKey, string> = {
  pv: 'Physical Vigor',
  mv: 'Mental Vigor',
  sv: 'Social Vigor',
  cv: 'Creative Vigor',
  spv: 'Spiritual Vigor',
};

export const VIGOR_SHORT_LABELS: Record<VigorKey, string> = {
  pv: 'PV',
  mv: 'MV',
  sv: 'SV',
  cv: 'CV',
  spv: 'SPV',
};

export const VIGOR_COLORS: Record<VigorKey, string> = {
  pv: 'bg-red-500',
  mv: 'bg-blue-500',
  sv: 'bg-amber-500',
  cv: 'bg-purple-500',
  spv: 'bg-teal-500',
};

export const VIGOR_TEXT_COLORS: Record<VigorKey, string> = {
  pv: 'text-red-500',
  mv: 'text-blue-500',
  sv: 'text-amber-500',
  cv: 'text-purple-500',
  spv: 'text-teal-500',
};

export const MEAL_LABELS: Record<MealQuality, string> = {
  STREET_FOOD: 'Street Food',
  HOME_COOKED: 'Home Cooked',
  RESTAURANT: 'Restaurant',
  FINE_DINING: 'Fine Dining',
  NUTRIENT_OPTIMAL: 'Nutrient Optimal',
};

export const MEAL_PRICES_CENTS: Record<MealQuality, number> = {
  STREET_FOOD: 300,
  HOME_COOKED: 500,
  RESTAURANT: 1200,
  FINE_DINING: 3000,
  NUTRIENT_OPTIMAL: 2000,
};

export const SLEEP_LABELS: Record<string, string> = {
  awake: 'Awake',
  sleeping: 'Sleeping',
  exhausted: 'Exhausted',
};
