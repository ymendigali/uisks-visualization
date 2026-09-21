import { useMemo, useState } from 'react';
import { regionsData } from '../components/Home/regionsData';
import type { RegionContextValue, RegionId } from '../context/RegionContext';

// Page-scoped region selection: same shape as RegionContext, but its state
// is local to whichever page calls it, so picking a region on one page
// (e.g. the Home map) never affects the region filter on any other page.
export const useLocalRegionSelection = (initialRegionId: RegionId = 'national'): RegionContextValue => {
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>(initialRegionId);

  return useMemo(() => {
    const selectedRegion = regionsData.find((region) => region.id === selectedRegionId) ?? null;

    return {
      selectedRegionId,
      setSelectedRegionId,
      selectedRegion,
      isNational: selectedRegion === null,
      regions: regionsData,
    };
  }, [selectedRegionId]);
};
