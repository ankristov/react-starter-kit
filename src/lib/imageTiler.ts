/**
 * Image Tiler - Converts an image into a grid of tiles
 * Each tile can be treated as an individual particle with texture
 */

export interface ImageTile {
  id: string;
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
  tileSize: number;
  imageData: ImageData; // The tile's image data
  color: string; // Average color of the tile (for fallback)
}

export interface TileGridConfig {
  gridSize: number; // e.g., 16 means 16x16 grid
  imageWidth: number;
  imageHeight: number;
  tilePixelSize: number;
}

/**
 * Generate tiles from an image
 * Tile size and grid are calculated based on CANVAS dimensions, not image dimensions
 * - Grid size applies to the shortest canvas dimension
 * - Tile size = shortestCanvasDim / gridSize (floor)
 * - All tiles are square except for remainder in last row/column which fill gaps
 * - Image is scaled to canvas size during particle creation
 */
export function generateTilesFromImage(
  imageData: ImageData,
  gridSize: number,
  canvasWidth?: number,
  canvasHeight?: number
): ImageTile[] {
  const { width: imgWidth, height: imgHeight } = imageData;
  const tiles: ImageTile[] = [];

  if (imgWidth <= 0 || imgHeight <= 0 || gridSize <= 0) {
    console.warn(`[ImageTiler] Invalid parameters: ${imgWidth}x${imgHeight}, gridSize: ${gridSize}`);
    return tiles;
  }

  // Use provided canvas dimensions, or fall back to image dimensions
  const canvasW = canvasWidth || imgWidth;
  const canvasH = canvasHeight || imgHeight;

  // Grid size applies to the SHORTEST canvas dimension
  const shortestCanvasDim = Math.min(canvasW, canvasH);
  const longestCanvasDim = Math.max(canvasW, canvasH);
  const isCanvasWiderThanTall = canvasW >= canvasH;
  
  // Calculate tile size based on canvas shortest dimension (floor division)
  const tileSize = Math.max(1, Math.floor(shortestCanvasDim / gridSize));
  
  // Calculate number of tiles in each dimension
  // Shortest dimension gets exactly gridSize tiles
  // Longest dimension gets ceil(longestDim / tileSize) tiles to fill completely
  const tilesInShortestDim = gridSize;
  const tilesInLongestDim = Math.ceil(longestCanvasDim / tileSize);
  
  const tilesWide = isCanvasWiderThanTall ? tilesInLongestDim : tilesInShortestDim;
  const tilesTall = isCanvasWiderThanTall ? tilesInShortestDim : tilesInLongestDim;

  console.log(
    `[ImageTiler] Creating tile crops from ${imgWidth}x${imgHeight} image for ${canvasW}x${canvasH} canvas`,
    `Grid size: ${gridSize}, tile size: ${tileSize}px`,
    `Grid: ${tilesWide}x${tilesTall} (${tilesWide * tilesTall} total tiles)`
  );

  for (let row = 0; row < tilesTall; row++) {
    for (let col = 0; col < tilesWide; col++) {
      // Calculate canvas positions for this tile
      // Tiles are positioned on the canvas grid (not image grid)
      const canvasXStart = col * tileSize;
      const canvasYStart = row * tileSize;
      
      // Calculate canvas end position (with remainders for last row/col)
      let canvasXEnd = (col + 1) * tileSize;
      let canvasYEnd = (row + 1) * tileSize;
      
      // Last column might be narrower to exactly fill canvas width
      if (col === tilesWide - 1) {
        canvasXEnd = canvasW;
      }
      
      // Last row might be shorter to exactly fill canvas height
      if (row === tilesTall - 1) {
        canvasYEnd = canvasH;
      }
      
      const canvasTileWidth = canvasXEnd - canvasXStart;
      const canvasTileHeight = canvasYEnd - canvasYStart;
      
      // Map canvas tile positions to image coordinates
      // Scale image to fit canvas
      const scaleX = imgWidth / canvasW;
      const scaleY = imgHeight / canvasH;
      
      const imageXStart = Math.floor(canvasXStart * scaleX);
      const imageYStart = Math.floor(canvasYStart * scaleY);
      const imageXEnd = Math.ceil(canvasXEnd * scaleX);
      const imageYEnd = Math.ceil(canvasYEnd * scaleY);
      
      // Clamp to image bounds
      const startX = Math.max(0, Math.min(imageXStart, imgWidth - 1));
      const startY = Math.max(0, Math.min(imageYStart, imgHeight - 1));
      const endX = Math.max(startX + 1, Math.min(imageXEnd, imgWidth));
      const endY = Math.max(startY + 1, Math.min(imageYEnd, imgHeight));
      
      const tileImageWidth = endX - startX;
      const tileImageHeight = endY - startY;

      if (tileImageWidth <= 0 || tileImageHeight <= 0) {
        console.warn(`[ImageTiler] Skipping invalid tile at grid [${row},${col}]: image size ${tileImageWidth}x${tileImageHeight}`);
        continue;
      }

      // Extract tile image data
      const tileImageData = extractTileImageData(
        imageData,
        startX,
        startY,
        tileImageWidth,
        tileImageHeight
      );

      const avgColor = calculateAverageColor(tileImageData);

      const tile: ImageTile = {
        id: `tile-${row}-${col}`,
        gridX: col,
        gridY: row,
        pixelX: canvasXStart,  // Store canvas position (not image position)
        pixelY: canvasYStart,
        tileSize: canvasTileWidth,  // Store actual canvas tile width (may be partial in last column)
        imageData: tileImageData,
        color: avgColor,
      };

      tiles.push(tile);
    }
  }

  console.log(`[ImageTiler] Generated ${tiles.length} tiles (expected ${tilesWide * tilesTall})`);
  
  if (tiles.length === 0) {
    console.error(`[ImageTiler] ERROR: No tiles generated! Canvas: ${canvasW}x${canvasH}, GridSize: ${gridSize}, TileSize: ${tileSize}, Grid: ${tilesWide}x${tilesTall}`);
  }
  
  return tiles;
}

/**
 * Extract image data for a specific region
 * Worker-safe version using only APIs available in both main thread and workers
 */
function extractTileImageData(
  sourceImageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData {
  // Create new ImageData for the tile
  const tileData = new ImageData(width, height);
  const sourceData = sourceImageData.data;
  const tilePixelData = tileData.data;
  const sourceWidth = sourceImageData.width;

  // Copy pixels from source to tile
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const sourcePixelIndex = ((y + ty) * sourceWidth + (x + tx)) * 4;
      const tilePixelIndex = (ty * width + tx) * 4;

      // Copy RGBA values
      tilePixelData[tilePixelIndex] = sourceData[sourcePixelIndex];
      tilePixelData[tilePixelIndex + 1] = sourceData[sourcePixelIndex + 1];
      tilePixelData[tilePixelIndex + 2] = sourceData[sourcePixelIndex + 2];
      tilePixelData[tilePixelIndex + 3] = sourceData[sourcePixelIndex + 3];
    }
  }

  return tileData;
}

/**
 * Calculate average color of an image region
 */
function calculateAverageColor(imageData: ImageData): string {
  const { data } = imageData;
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  let pixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] > 0) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
      pixelCount++;
    }
  }

  if (pixelCount === 0) {
    return '#888888'; // Fallback for fully transparent tiles
  }

  r = Math.round(r / pixelCount);
  g = Math.round(g / pixelCount);
  b = Math.round(b / pixelCount);
  a = Math.round(a / pixelCount);

  // Return as rgb or rgba
  if (a < 255) {
    return `rgba(${r},${g},${b},${a / 255})`;
  }
  return `rgb(${r},${g},${b})`;
}

/**
 * Convert tiles back to canvas for preview
 */
export function tilesToCanvas(
  tiles: ImageTile[],
  tileCanvasSize: number
): HTMLCanvasElement {
  // Find grid dimensions
  const maxX = Math.max(...tiles.map((t) => t.gridX));
  const maxY = Math.max(...tiles.map((t) => t.gridY));

  const gridWidth = maxX + 1;
  const gridHeight = maxY + 1;

  const canvas = document.createElement('canvas');
  canvas.width = gridWidth * tileCanvasSize;
  canvas.height = gridHeight * tileCanvasSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  for (const tile of tiles) {
    const x = tile.gridX * tileCanvasSize;
    const y = tile.gridY * tileCanvasSize;

    // Create temporary canvas for this tile
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tile.tileSize;
    tileCanvas.height = tile.tileSize;
    const tileCtx = tileCanvas.getContext('2d');
    if (!tileCtx) continue;

    tileCtx.putImageData(tile.imageData, 0, 0);

    // Draw to main canvas (scaled to tile size)
    ctx.drawImage(tileCanvas, x, y, tileCanvasSize, tileCanvasSize);
  }

  return canvas;
}

/**
 * Get grid configuration from tiles
 */
export function getTileGridConfig(tiles: ImageTile[]): TileGridConfig {
  if (tiles.length === 0) {
    return {
      gridSize: 0,
      imageWidth: 0,
      imageHeight: 0,
      tilePixelSize: 0,
    };
  }

  const maxX = Math.max(...tiles.map((t) => t.gridX));
  const maxY = Math.max(...tiles.map((t) => t.gridY));

  // Calculate approximate tile pixel size
  const firstTile = tiles[0];
  const tilePixelSize = firstTile.tileSize;

  return {
    gridSize: maxX + 1, // Assuming square grid
    imageWidth: (maxX + 1) * tilePixelSize,
    imageHeight: (maxY + 1) * tilePixelSize,
    tilePixelSize,
  };
}
