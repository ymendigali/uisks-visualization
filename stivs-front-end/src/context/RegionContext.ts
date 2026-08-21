import { createContext, useContext } from 'react';
import type { RegionShape } from '../components/Home/regionsData';

export type RegionId = 'national' | RegionShape['id'];

export interface RegionContextValue {
  selectedRegionId: RegionId;
  setSelectedRegionId: (regionId: RegionId) => void;
  selectedRegion: RegionShape | null;
  isNational: boolean;
  regions: RegionShape[];
}

export const RegionContext = createContext<RegionContextValue | undefined>(undefined);

export const useRegionContext = (): RegionContextValue => {
  const context = useContext(RegionContext);

  if (!context) {
    throw new Error('useRegionContext must be used within a RegionProvider');
  }

  return context;
};
