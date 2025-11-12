import type { ColorInfo } from '../types/particle';

// Color name mapping for common colors
const colorNames: Record<string, string> = {
  '#ff0000': 'Red',
  '#00ff00': 'Green',
  '#0000ff': 'Blue',
  '#ffff00': 'Yellow',
  '#ff00ff': 'Magenta',
  '#00ffff': 'Cyan',
  '#ffffff': 'White',
  '#000000': 'Black',
  '#ffa500': 'Orange',
  '#800080': 'Purple',
  '#008000': 'Dark Green',
  '#000080': 'Navy Blue',
  '#800000': 'Maroon',
  '#808000': 'Olive',
  '#008080': 'Teal',
  '#c0c0c0': 'Silver',
  '#808080': 'Gray',
};

// Convert RGB values to hex color
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert hex color to RGB values
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle rgb(r, g, b) format
  const rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
  }
  
  // Handle hex format
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Calculate Euclidean distance between two RGB colors
export function getColorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// Calculate color similarity (0-1, where 1 is identical)
export function getColorSimilarity(color1: string, color2: string): number {
  const distance = getColorDistance(color1, color2);
  // Normalize to 0-1 (max distance is sqrt(255^2 * 3) ≈ 441.67)
  return Math.max(0, 1 - distance / 441.67);
}

// Get color name with fallback
export function getColorName(color: string): string {
  return colorNames[color] || `Color ${color}`;
}

// Simplified color grouping - no expensive clustering
export interface ColorGroup {
  id: string;
  representativeColor: string;
  colors: string[];
  count: number;
  percentage: number;
  name: string;
  rgb: { r: number; g: number; b: number };
}

// Color grouping based on specified number of clusters using proper K-means clustering
export function createColorGroups(particles: Array<{ color: string }>, targetClusters: number = 10): ColorGroup[] {
  const colorCounts = new Map<string, number>();
  
  // Count occurrences of each color
  for (const particle of particles) {
    const count = colorCounts.get(particle.color) || 0;
    colorCounts.set(particle.color, count + 1);
  }
  
  // Get all unique colors
  const uniqueColors = Array.from(colorCounts.keys());
  
  if (uniqueColors.length === 0) return [];
  
  // If we have fewer colors than target clusters, return each color as its own group
  if (uniqueColors.length <= targetClusters) {
    return uniqueColors.map((color, index) => ({
      id: `group-${index}`,
      representativeColor: color,
      colors: [color],
      count: colorCounts.get(color) || 0,
      percentage: ((colorCounts.get(color) || 0) / particles.length) * 100,
      name: getColorName(color),
      rgb: hexToRgb(color),
    }));
  }
  
  // Convert colors to RGB arrays for clustering
  const colorRgbs = uniqueColors.map(color => {
    const rgb = hexToRgb(color);
    return { color, rgb: [rgb.r, rgb.g, rgb.b], count: colorCounts.get(color) || 0 };
  });
  
  // Sort by frequency (most frequent first) for better initial clustering
  colorRgbs.sort((a, b) => b.count - a.count);
  
  // Initialize cluster centers using k-means++ approach
  const clusterCenters: number[][] = [];
  const usedIndices = new Set<number>();
  
  // First center: most frequent color
  clusterCenters.push([...colorRgbs[0].rgb]);
  usedIndices.add(0);
  
  // Add remaining centers using k-means++ approach
  for (let i = 1; i < targetClusters; i++) {
    const distances: number[] = [];
    let totalDistance = 0;
    
    // Calculate minimum distance to existing centers for each color
    for (let j = 0; j < colorRgbs.length; j++) {
      if (usedIndices.has(j)) {
        distances.push(0);
        continue;
      }
      
      let minDistance = Infinity;
      for (const center of clusterCenters) {
        const distance = Math.sqrt(
          Math.pow(colorRgbs[j].rgb[0] - center[0], 2) +
          Math.pow(colorRgbs[j].rgb[1] - center[1], 2) +
          Math.pow(colorRgbs[j].rgb[2] - center[2], 2)
        );
        minDistance = Math.min(minDistance, distance);
      }
      distances.push(minDistance);
      totalDistance += minDistance;
    }
    
    // Select next center with probability proportional to distance squared
    const random = Math.random() * totalDistance;
    let cumulativeDistance = 0;
    let selectedIndex = -1;
    
    for (let j = 0; j < distances.length; j++) {
      if (usedIndices.has(j)) continue;
      cumulativeDistance += distances[j];
      if (cumulativeDistance >= random) {
        selectedIndex = j;
        break;
      }
    }
    
    // Fallback: select the color with maximum distance
    if (selectedIndex === -1) {
      let maxDistance = 0;
      for (let j = 0; j < distances.length; j++) {
        if (!usedIndices.has(j) && distances[j] > maxDistance) {
          maxDistance = distances[j];
          selectedIndex = j;
        }
      }
    }
    
    if (selectedIndex !== -1) {
      clusterCenters.push([...colorRgbs[selectedIndex].rgb]);
      usedIndices.add(selectedIndex);
    }
  }
  
  // K-means iteration with similarity threshold
  const maxIterations = 50;
  let iterations = 0;
  let converged = false;
  let currentClusters: Array<{ colors: typeof colorRgbs, center: number[] }> = [];
  
  while (!converged && iterations < maxIterations) {
    iterations++;
    converged = true;
    
    // Assign colors to nearest cluster
    currentClusters = Array.from({ length: targetClusters }, () => ({ colors: [], center: [0, 0, 0] }));
    
    for (const colorRgb of colorRgbs) {
      let bestClusterIndex = 0;
      let bestDistance = Infinity;
      
      // Find nearest cluster center
      for (let i = 0; i < clusterCenters.length; i++) {
        const distance = Math.sqrt(
          Math.pow(colorRgb.rgb[0] - clusterCenters[i][0], 2) +
          Math.pow(colorRgb.rgb[1] - clusterCenters[i][1], 2) +
          Math.pow(colorRgb.rgb[2] - clusterCenters[i][2], 2)
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestClusterIndex = i;
        }
      }
      
      // Only assign to cluster if the distance is reasonable (not too different)
      // Use a threshold of 80 (about 18% of max distance) to prevent very different colors from grouping
      if (bestDistance < 80) {
        currentClusters[bestClusterIndex].colors.push(colorRgb);
      }
      // If color is too different, it will remain unassigned (will be handled later)
    }
    
    // Update cluster centers
    for (let i = 0; i < currentClusters.length; i++) {
      if (currentClusters[i].colors.length === 0) continue;
      
      const newCenter = [0, 0, 0];
      let totalWeight = 0;
      
      // Calculate weighted average (weighted by color frequency)
      for (const colorRgb of currentClusters[i].colors) {
        const weight = colorRgb.count;
        newCenter[0] += colorRgb.rgb[0] * weight;
        newCenter[1] += colorRgb.rgb[1] * weight;
        newCenter[2] += colorRgb.rgb[2] * weight;
        totalWeight += weight;
      }
      
      if (totalWeight > 0) {
        newCenter[0] /= totalWeight;
        newCenter[1] /= totalWeight;
        newCenter[2] /= totalWeight;
        
        // Check if center moved significantly
        const centerDistance = Math.sqrt(
          Math.pow(newCenter[0] - clusterCenters[i][0], 2) +
          Math.pow(newCenter[1] - clusterCenters[i][1], 2) +
          Math.pow(newCenter[2] - clusterCenters[i][2], 2)
        );
        
        if (centerDistance > 1) { // Threshold for convergence
          converged = false;
        }
        
        clusterCenters[i] = newCenter;
      }
    }
  }
  
  // Convert clusters to ColorGroup format
  const groups: ColorGroup[] = [];
  
  for (let i = 0; i < currentClusters.length; i++) {
    const cluster = currentClusters[i];
    if (cluster.colors.length === 0) continue;
    
    // Find the most frequent color in this cluster as representative
    const representativeColor = cluster.colors.reduce((max: typeof colorRgbs[0], current: typeof colorRgbs[0]) => 
      current.count > max.count ? current : max).color;
    
    const totalCount = cluster.colors.reduce((sum: number, colorRgb: typeof colorRgbs[0]) => sum + colorRgb.count, 0);
    const percentage = (totalCount / particles.length) * 100;
    
    groups.push({
      id: `group-${i}`,
      representativeColor,
      colors: cluster.colors.map((c: typeof colorRgbs[0]) => c.color),
      count: totalCount,
      percentage,
      name: getColorName(representativeColor),
      rgb: hexToRgb(representativeColor),
    });
  }
  
  // Handle unassigned colors by creating individual groups for them
  const assignedColors = new Set<string>();
  for (const group of groups) {
    for (const color of group.colors) {
      assignedColors.add(color);
    }
  }
  
  const unassignedColors = colorRgbs.filter(c => !assignedColors.has(c.color));
  for (const colorRgb of unassignedColors) {
    groups.push({
      id: `group-${groups.length}`,
      representativeColor: colorRgb.color,
      colors: [colorRgb.color],
      count: colorRgb.count,
      percentage: (colorRgb.count / particles.length) * 100,
      name: getColorName(colorRgb.color),
      rgb: hexToRgb(colorRgb.color),
    });
  }
  
  // Sort by count (descending) and return exactly targetClusters groups
  return groups
    .sort((a, b) => b.count - a.count)
    .slice(0, targetClusters);
}

// Analyze particle colors and create color histogram (legacy function)
export function analyzeParticleColors(particles: Array<{ color: string }>): ColorInfo[] {
  const colorCounts = new Map<string, number>();
  
  // Count occurrences of each color
  for (const particle of particles) {
    const count = colorCounts.get(particle.color) || 0;
    colorCounts.set(particle.color, count + 1);
  }
  
  // Convert to array and sort by count (descending)
  const colorEntries = Array.from(colorCounts.entries())
    .map(([color, count]) => ({
      color,
      count,
      percentage: (count / particles.length) * 100,
      name: getColorName(color),
      rgb: hexToRgb(color),
    }))
    .sort((a, b) => b.count - a.count);
  
  return colorEntries;
}

// Check if a particle should be visible based on color filter
export function shouldShowParticle(
  particleColor: string,
  selectedColors: string[],
  filterMode: 'show' | 'hide',
  colorTolerance: number = 0.2
): boolean {
  if (selectedColors.length === 0) {
    return true; // No filter applied
  }
  
  // Check if particle color matches any selected color (with tolerance)
  const matchesSelected = selectedColors.some(selectedColor => 
    getColorDistance(particleColor, selectedColor) <= (colorTolerance * 441.67) // Convert tolerance to distance
  );
  
  return filterMode === 'show' ? matchesSelected : !matchesSelected;
} 