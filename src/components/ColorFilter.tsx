import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useForceFieldStore } from '../store/forceFieldStore';
import { analyzeParticleColors, createColorGroups } from '../lib/colorUtils';
import type { ColorGroup } from '../types/particle';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Palette, RotateCcw, ChevronDown, ChevronRight, Info } from 'lucide-react';

export function ColorFilter() {
  const {
    particles,
    settings: { colorFilterSettings },
    toggleColorFilter,
    updateSettings,
    resetColorFilter,
    selectAllColors,
    setFilterMode,
  } = useForceFieldStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Memoize color analysis to avoid recalculating on every render
  const memoizedColorAnalysis = useMemo(() => {
    if (particles.length === 0) return [];
    return analyzeParticleColors(particles);
  }, [particles]);

  // Memoize color groups with debounced tolerance changes
  const memoizedColorGroups = useMemo(() => {
    if (particles.length === 0) return [];
    const targetClusters = colorFilterSettings.colorTolerance;
    return createColorGroups(particles, targetClusters);
  }, [particles, colorFilterSettings.colorTolerance]);

  // Update store only when analysis actually changes
  useEffect(() => {
    if (memoizedColorAnalysis.length > 0) {
      // updateColorAnalysis(memoizedColorAnalysis); // This line was removed from the new_code, so it's removed here.
    }
  }, [memoizedColorAnalysis]); // Removed updateColorAnalysis from dependency array

  // Update color groups only when they actually change
  useEffect(() => {
    if (memoizedColorGroups.length > 0) {
      // updateColorGroups(memoizedColorGroups); // This line was removed from the new_code, so it's removed here.
    }
  }, [memoizedColorGroups]); // Removed updateColorGroups from dependency array

  const handleColorGroupClick = useCallback((group: ColorGroup) => {
    // Check if all colors in the group are already selected
    const allSelected = group.colors.every((color: string) => 
      colorFilterSettings.selectedColors.includes(color)
    );
    
    if (allSelected) {
      // If all are selected, deselect all
      group.colors.forEach((color: string) => {
        toggleColorFilter(color);
      });
    } else {
      // If not all are selected, select all
      group.colors.forEach((color: string) => {
        if (!colorFilterSettings.selectedColors.includes(color)) {
          toggleColorFilter(color);
        }
      });
    }
  }, [colorFilterSettings.selectedColors, toggleColorFilter]);

  // Individual color tiles were removed from UI; keep group toggles only

  const handleReset = useCallback(() => {
    resetColorFilter();
    // Also disable the filter to show all particles
    updateSettings({
      colorFilterSettings: {
        ...colorFilterSettings,
        enabled: false,
      },
    });
  }, [resetColorFilter, updateSettings, colorFilterSettings]);

  const handleToleranceChange = useCallback((value: number[]) => {
    updateSettings({
      colorFilterSettings: {
        ...colorFilterSettings,
        colorTolerance: value[0],
      },
    });
  }, [updateSettings, colorFilterSettings]);

  const isGroupSelected = useCallback((group: ColorGroup) => {
    return group.colors.every((color: string) => 
      colorFilterSettings.selectedColors.includes(color)
    );
  }, [colorFilterSettings.selectedColors]);

  const isGroupPartiallySelected = useCallback((group: ColorGroup) => {
    const selectedCount = group.colors.filter((color: string) => 
      colorFilterSettings.selectedColors.includes(color)
    ).length;
    return selectedCount > 0 && selectedCount < group.colors.length;
  }, [colorFilterSettings.selectedColors]);

  const getSelectedColorsInGroup = useCallback((group: ColorGroup) => {
    return group.colors.filter((color: string) => 
      colorFilterSettings.selectedColors.includes(color)
    );
  }, [colorFilterSettings.selectedColors]);

  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Select all colors from all groups
  const handleSelectAll = useCallback(() => {
    const allColors = memoizedColorGroups.flatMap(group => group.colors);
    const currentSelectedColors = colorFilterSettings.selectedColors;
    
    // Check if all colors are currently selected
    const allSelected = allColors.length > 0 && allColors.every(color => 
      currentSelectedColors.includes(color)
    );
    
    if (allSelected) {
      // If all are selected, deselect all using the same method as individual color groups
      allColors.forEach((color: string) => {
        toggleColorFilter(color);
      });
    } else {
      // If not all are selected, select all
      selectAllColors(allColors);
    }
  }, [memoizedColorGroups, colorFilterSettings.selectedColors, toggleColorFilter, selectAllColors]);

  // Check if all colors are selected
  const areAllColorsSelected = useMemo(() => {
    if (memoizedColorGroups.length === 0) return false;
    const allColors = memoizedColorGroups.flatMap(group => group.colors);
    if (allColors.length === 0) return false;
    const currentSelectedColors = colorFilterSettings.selectedColors;
    
    // More explicit check
    const allSelected = allColors.every(color => currentSelectedColors.includes(color));
    return allSelected;
  }, [memoizedColorGroups, colorFilterSettings.selectedColors]);

  // Select all colors by default when groups are loaded
  useEffect(() => {
    if (memoizedColorGroups.length > 0 && colorFilterSettings.selectedColors.length === 0) {
      const allColors = memoizedColorGroups.flatMap(group => group.colors);
      if (allColors.length > 0) {
        // Select all colors, enable the filter, and default to "Show selected"
        updateSettings({
          colorFilterSettings: {
            ...colorFilterSettings,
            selectedColors: allColors,
            enabled: true,
            filterMode: 'show',
          },
        });
      }
    }
  }, [memoizedColorGroups, colorFilterSettings.selectedColors.length, colorFilterSettings, updateSettings]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 space-y-4">
      {/* Header - Always visible */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-lg font-semibold text-purple-200 hover:text-purple-100 transition-colors"
        >
          <Palette className="w-5 h-5" />
          Color Filter
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {/* Reset Filter Button - Icon only */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Reset color filters"
          onClick={handleReset}
          className="h-8 w-8 p-0 bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          {/* Mode selection */}
          <div className="space-y-2">
            <label className="block text-sm text-purple-200">Mode</label>
            <select
              value={colorFilterSettings.filterMode}
              onChange={(e) => setFilterMode(e.target.value as 'show' | 'hide')}
              className="w-full bg-slate-800 border border-purple-500/30 rounded px-2 py-1 text-purple-200"
            >
              <option value="show">Show selected</option>
              <option value="hide">Hide selected</option>
            </select>
          </div>
          {/* Color Tolerance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-purple-200">
                <span>Number of Clusters</span>
                <Info className="w-3.5 h-3.5 opacity-80" title="How many color groups to create from the image. Higher = more groups (finer palette), lower = fewer (coarser)." />
              </div>
              <div className="text-xs text-purple-300">{colorFilterSettings.colorTolerance} (1..20)</div>
            </div>
            <Slider
              value={[colorFilterSettings.colorTolerance]}
              onValueChange={handleToleranceChange}
              max={20}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="text-xs text-purple-400">
              Higher values create more color groups. Lower values create fewer, larger groups. This affects grouping only, not filtering.
            </div>
          </div>

          {/* Color Groups Mosaic */}
          <div className="space-y-2">
            {/* Responsive, non-overlapping swatch grid */}
            <div className="flex flex-wrap gap-1.5">
              {memoizedColorGroups.map((group: ColorGroup) => {
                const isSelected = isGroupSelected(group);
                return (
                  <button
                    key={group.id}
                    onClick={() => handleColorGroupClick(group)}
                    aria-pressed={isSelected}
                    className={`w-8 h-8 rounded-md border transition-transform duration-150 hover:scale-110 focus:outline-none ${
                      isSelected
                        ? 'border-purple-300 ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 shadow-md shadow-purple-500/30'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: group.representativeColor }}
                    title={`Toggle group`}
                  />
                );
              })}
            </div>
          </div>

          
        </>
      )}
    </div>
  );
} 