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
 * Creates ALWAYS SQUARE tiles based on the shortest dimension
 * Grid size = number of cells in the shortest dimension
 * Tile sizes are adjusted so they fit PERFECTLY without gaps using integer math
 */
export function generateTilesFromImage(
  imageData: ImageData,
  gridSize: number
): ImageTile[] {
  const { width: imgWidth, height: imgHeight } = imageData;
  const tiles: ImageTile[] = [];

  if (imgWidth <= 0 || imgHeight <= 0 || gridSize <= 0) {
    console.warn(`[ImageTiler] Invalid parameters: ${imgWidth}x${imgHeight}, gridSize: ${gridSize}`);
    return tiles;
  }

  // Grid size applies to the SHORTEST dimension
  const shortestDim = Math.min(imgWidth, imgHeight);
  
  // Calculate tile size for the shortest dimension (round down)
  const baseTileSize = Math.max(1, Math.floor(shortestDim / gridSize));
  
  // Calculate how many tiles we need in each dimension
  const tilesWide = Math.ceil(imgWidth / baseTileSize);
  const tilesTall = Math.ceil(imgHeight / baseTileSize);
  
  // Use the maximum to ensure all tiles are square
  const squareTileSize = Math.max(
    Math.ceil(imgWidth / tilesWide),
    Math.ceil(imgHeight / tilesTall)
  );

  console.log(
    `[ImageTiler] Creating square crops from ${imgWidth}x${imgHeight} image`,
    `Grid size: ${gridSize}, base tile: ${baseTileSize}px`,
    `Square tile size: ${squareTileSize}px, Grid: ${tilesWide}x${tilesTall}`
  );

  for (let row = 0; row < tilesTall; row++) {
    for (let col = 0; col < tilesWide; col++) {
      // Calculate tile boundaries
      // Use simple grid positioning: each tile gets squareTileSize pixels
      // except the last tile in each dimension which extends to the image boundary
      const pixelXStart = col * squareTileSize;
      const pixelYStart = row * squareTileSize;
      
      // Last column extends to image right edge, others get full tile size
      const pixelXEnd = col === tilesWide - 1 ? imgWidth : Math.min((col + 1) * squareTileSize, imgWidth);
      // Last row extends to image bottom edge, others get full tile size
      const pixelYEnd = row === tilesTall - 1 ? imgHeight : Math.min((row + 1) * squareTileSize, imgHeight);
      
      // Clamp to valid bounds
      const startX = Math.max(0, Math.min(pixelXStart, imgWidth - 1));
      const startY = Math.max(0, Math.min(pixelYStart, imgHeight - 1));
      const endX = Math.max(startX + 1, Math.min(pixelXEnd, imgWidth));
      const endY = Math.max(startY + 1, Math.min(pixelYEnd, imgHeight));
      
      const tileWidth = endX - startX;
      const tileHeight = endY - startY;

      if (tileWidth <= 0 || tileHeight <= 0) {
        console.warn(`[ImageTiler] Skipping invalid tile at [${row},${col}]: ${tileWidth}x${tileHeight}`);
        continue;
      }

      // Extract tile image data
      const tileImageData = extractTileImageData(
        imageData,
        startX,
        startY,
        tileWidth,
        tileHeight
      );

      const avgColor = calculateAverageColor(tileImageData);

      const tile: ImageTile = {
        id: `tile-${row}-${col}`,
        gridX: col,
        gridY: row,
        pixelX: startX,  // Store the ACTUAL pixel position where tile was extracted
        pixelY: startY,
        tileSize: squareTileSize,
        imageData: tileImageData,
        color: avgColor,
      };

      tiles.push(tile);
    }
  }

  console.log(`[ImageTiler] Generated ${tiles.length} tiles (expected ${tilesWide * tilesTall})`);
  
  if (tiles.length === 0) {
    console.error(`[ImageTiler] ERROR: No tiles generated! Image: ${imgWidth}x${imgHeight}, GridSize: ${gridSize}, BaseTile: ${baseTileSize}, Grid: ${tilesWide}x${tilesTall}`);
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
