'use client';
import { useQuery } from '@tanstack/react-query';
import { loadRestaurants } from '../data/restaurant-api';
export function useRestaurants() {
  return useQuery({ queryKey: ['marketplace', 'restaurants'], queryFn: () => loadRestaurants(true) });
}
