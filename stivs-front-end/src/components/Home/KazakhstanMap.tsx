import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';
import './KazakhstanMap.css';
import { regionsData } from './regionsData';
import type { RegionType } from './regionsData';
import mapGeoJsonUrl from '../../assets/geo/kazakhstan-adm1.geojson?url';

interface KazakhstanMapProps {
  selectedRegionId: string;
  onRegionSelect: (regionId: string) => void;
  getRegionFill?: (regionId: string) => string | undefined;
  useShortLabels?: boolean;
  showLabels?: boolean;
}

type MapFeature = {
  id: string;
  path: string;
  centroid: [number, number];
  label: [number, number];
  type: RegionType;
  shortName: string;
  name: string;
};

const KazakhstanMap: React.FC<KazakhstanMapProps> = ({
  selectedRegionId,
  onRegionSelect,
  getRegionFill,
  useShortLabels = true,
  showLabels = true,
}) => {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [featureCollection, setFeatureCollection] = useState<FeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadGeoJson = async () => {
      try {
        const response = await fetch(mapGeoJsonUrl);
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные карты');
        }

        const data = (await response.json()) as FeatureCollection;
        if (isActive) {
          setFeatureCollection(data);
        }
      } catch (error) {
        if (isActive) {
          setLoadError(error instanceof Error ? error.message : 'Ошибка загрузки карты');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadGeoJson();

    return () => {
      isActive = false;
    };
  }, []);

  const regionLookup = useMemo(() => {
    return new Map(regionsData.map((region) => [region.id, region]));
  }, []);

  const mapFeatures = useMemo(() => {
    if (!featureCollection) {
      return [];
    }

    const projection = geoMercator().fitSize([820, 560], featureCollection);
    const pathGenerator = geoPath(projection);

    return featureCollection.features
      .map((feature) => {
        const props = feature.properties as Feature['properties'] & {
          id?: string;
          name?: string;
          type?: string;
        };

        if (!props?.id) {
          return null;
        }

        const path = pathGenerator(feature as Feature) ?? '';
        const [cx, cy] = pathGenerator.centroid(feature as Feature);
        const regionMeta = regionLookup.get(props.id);
        const labelOffset = regionMeta?.labelOffset ?? { x: 0, y: 0 };

        const featureType: RegionType = (props.type as RegionType) ?? 'region';

        return {
          id: props.id,
          path,
          centroid: [cx, cy] as [number, number],
          label: [cx + labelOffset.x, cy + labelOffset.y] as [number, number],
          type: featureType,
          shortName: regionMeta?.shortName ?? props.name ?? props.id,
          name: regionMeta?.name ?? props.name ?? props.id,
        } satisfies MapFeature;
      })
      .filter((item): item is MapFeature => item !== null);
  }, [featureCollection, regionLookup]);

  const regionFeatures = useMemo(() => {
    return mapFeatures.filter((feature) => feature.type === 'region');
  }, [mapFeatures]);

  const cityFeatures = useMemo(() => {
    return mapFeatures.filter((feature) => feature.type === 'city');
  }, [mapFeatures]);

  const handleSelect = useCallback(
    (regionId: string) => {
      onRegionSelect(regionId);
    },
    [onRegionSelect],
  );

  const renderFeature = useCallback(
    (feature: MapFeature) => {
      const isSelected = feature.id === selectedRegionId;
      const isHovered = feature.id === hoveredRegion;
      const isCity = feature.type === 'city';
      const customFill = getRegionFill?.(feature.id);
      const shouldTint = Boolean(customFill) && !isSelected && !isHovered;
      const shapeStyle = shouldTint ? { fill: customFill } : undefined;
      const pathStyle = isCity
        ? {
            pointerEvents: 'none' as const,
            ...shapeStyle,
          }
        : shapeStyle;

      return (
        <g key={feature.id} className="region-group">
          <path
            d={feature.path}
            tabIndex={isCity ? -1 : 0}
            role={isCity ? undefined : 'button'}
            aria-label={`Регион ${feature.name}`}
            aria-pressed={isCity ? undefined : isSelected}
            className={clsx('region-shape', {
              selected: isSelected,
              hovered: isHovered && !isSelected,
            })}
            style={pathStyle}
            onMouseEnter={!isCity ? () => setHoveredRegion(feature.id) : undefined}
            onMouseLeave={!isCity ? () => setHoveredRegion(null) : undefined}
            onFocus={!isCity ? () => setHoveredRegion(feature.id) : undefined}
            onBlur={!isCity ? () => setHoveredRegion(null) : undefined}
            onKeyDown={!isCity
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect(feature.id);
                  }
                }
              : undefined}
            onClick={!isCity ? () => handleSelect(feature.id) : undefined}
          />
          {isCity && (
            <circle
              className={clsx('city-marker', {
                selected: isSelected,
                hovered: isHovered && !isSelected,
              })}
              cx={feature.centroid[0]}
              cy={feature.centroid[1]}
              r={10}
              style={shouldTint ? { fill: customFill } : undefined}
              tabIndex={0}
              role="button"
              aria-label={`Город ${feature.name}`}
              aria-pressed={isSelected}
              onMouseEnter={() => setHoveredRegion(feature.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              onFocus={() => setHoveredRegion(feature.id)}
              onBlur={() => setHoveredRegion(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelect(feature.id);
                }
              }}
              onClick={() => handleSelect(feature.id)}
            />
          )}
          {showLabels && (
            <text x={feature.label[0]} y={feature.label[1]} className="region-label">
              {useShortLabels ? feature.shortName : feature.name}
            </text>
          )}
        </g>
      );
    },
    [getRegionFill, handleSelect, hoveredRegion, selectedRegionId, showLabels, useShortLabels],
  );

  if (isLoading) {
    return (
      <div className="map-loading" role="status" aria-live="polite">
        Загрузка карты...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="map-error" role="alert">
        {loadError}
      </div>
    );
  }

  if (!featureCollection) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 820 560"
      className="map-svg"
      role="img"
      aria-labelledby="kazakhstanMapTitle"
    >
      <title id="kazakhstanMapTitle">Карта Казахстана по регионам</title>
      <defs>
        <filter
          id="regionShadow"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="rgba(15, 23, 42, 0.25)" />
        </filter>
      </defs>
      <g filter="url(#regionShadow)">
        {regionFeatures.map(renderFeature)}
        {cityFeatures.map(renderFeature)}
      </g>
    </svg>
  );
};

export default KazakhstanMap;
