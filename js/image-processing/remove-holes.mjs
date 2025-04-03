/**
 * Removes small contiguous regions (holes or islands) in a canvas by replacing them with
 * an adjacent color.
 * 
 * @param {HTMLCanvasElement} canvas - The input canvas to process
 * @param {Object} options - Configuration options
 * @param {number} options.maxRegionSize - Maximum size of regions to remove (in pixels)
 * @param {boolean} options.includeAlpha - Whether to consider alpha channel when comparing colors
 * @param {boolean} options.debug - Enable debug logging
 * @returns {HTMLCanvasElement} The processed canvas
 */
export function removeSmallRegions(canvas, options = {}) {
  const { 
    maxRegionSize = 80,
    includeAlpha = false,
    debug = true  // Enable debug by default to troubleshoot
  } = options;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  if (debug) {
    console.log(`Processing image: ${width}x${height} pixels`);
    console.log(`Max region size to remove: ${maxRegionSize} pixels`);
  }
  
  // Create a visited array to track processed pixels
  const visited = new Uint8Array(width * height);
  
  // Direction vectors for 4-connected neighbors
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  
  // Compare two colors for equality
  function colorsEqual(idx1, idx2) {
    const channels = includeAlpha ? 4 : 3;
    for (let i = 0; i < channels; i++) {
      if (data[idx1 + i] !== data[idx2 + i]) {
        return false;
      }
    }
    return true;
  }
  
  // Get key for color at given index
  function getColorKey(idx) {
    return includeAlpha 
      ? `${data[idx]},${data[idx+1]},${data[idx+2]},${data[idx+3]}`
      : `${data[idx]},${data[idx+1]},${data[idx+2]}`;
  }
  
  // Collect all regions first, then process them by size
  const allRegions = [];
  
  // Function to find a contiguous region
  function findRegion(startX, startY) {
    const startIdx = (startY * width + startX) * 4;
    const startColorKey = getColorKey(startIdx);
    
    // Store region pixels and their border pixels
    const regionPixels = [];
    const borderPixels = new Map(); // Maps border pixel index to its color
    
    // Use BFS to find all connected pixels of the same color
    const queue = [{x: startX, y: startY}];
    visited[startY * width + startX] = 1;
    
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const pixelIdx = (y * width + x) * 4;
      regionPixels.push(pixelIdx);
      
      // Check all 4 neighboring pixels
      for (let i = 0; i < 4; i++) {
        const nx = x + dx[i];
        const ny = y + dy[i];
        
        // Skip if out of bounds
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        
        const neighborIdx = (ny * width + nx) * 4;
        const neighborVisitedIdx = ny * width + nx;
        
        if (!visited[neighborVisitedIdx]) {
          // If the neighbor has the same color, add it to the queue
          if (colorsEqual(pixelIdx, neighborIdx)) {
            queue.push({x: nx, y: ny});
            visited[neighborVisitedIdx] = 1;
          } else {
            // This is a border pixel with a different color
            borderPixels.set(neighborIdx, getColorKey(neighborIdx));
          }
        }
      }
      
      // Limit region growth for very large regions
      if (regionPixels.length > maxRegionSize * 3) {
        if (debug) {
          console.log(`Region too large (${regionPixels.length} pixels), stopping early`);
        }
        break;
      }
    }
    
    // Only add regions smaller than maxRegionSize
    if (regionPixels.length > 0 && regionPixels.length <= maxRegionSize && borderPixels.size > 0) {
      allRegions.push({
        size: regionPixels.length,
        pixels: regionPixels,
        borders: borderPixels,
        color: startColorKey
      });
    }
    
    return regionPixels.length; // Return region size for statistics
  }
  
  // First pass: Collect all regions
  let totalRegions = 0;
  let totalPixels = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const visitedIdx = y * width + x;
      
      if (!visited[visitedIdx]) {
        totalRegions++;
        const regionSize = findRegion(x, y);
        totalPixels += regionSize;
      }
    }
  }
  
  if (debug) {
    console.log(`Found ${totalRegions} total regions, ${allRegions.length} are smaller than ${maxRegionSize} pixels`);
    console.log(`Total pixels: ${totalPixels}, Image size: ${width * height}`);
  }
  
  // Sort regions by size (smallest first)
  allRegions.sort((a, b) => a.size - b.size);
  
  // Second pass: Remove regions starting from the smallest
  let modifiedRegions = 0;
  
  for (const region of allRegions) {
    // Find the most common border color
    const colorFrequency = new Map();
    for (const colorKey of region.borders.values()) {
      colorFrequency.set(colorKey, (colorFrequency.get(colorKey) || 0) + 1);
    }
    
    // Find the most common border color
    let mostCommonColor = null;
    let maxFrequency = 0;
    
    for (const [colorKey, frequency] of colorFrequency.entries()) {
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        mostCommonColor = colorKey;
      }
    }
    
    // Replace all pixels in this region with the most common border color
    if (mostCommonColor) {
      const [r, g, b, a = 255] = mostCommonColor.split(',').map(Number);
      
      if (debug && modifiedRegions < 10) { // Limit debug output
        console.log(`Replacing region of size ${region.size} with color ${region.color} with border color: ${mostCommonColor}`);
      }
      
      for (const pixelIdx of region.pixels) {
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        if (includeAlpha) {
          data[pixelIdx + 3] = a;
        }
      }
      
      modifiedRegions++;
    }
  }
  
  console.log(`Removed ${modifiedRegions} small regions from the image (out of ${allRegions.length} candidates)`);
  
  // Apply the modified data back to the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}

/**
 * Removes small holes (dark regions) from an image by replacing them with surrounding colors
 * 
 * @param {HTMLCanvasElement} canvas - The input canvas to process
 * @param {Object} options - Configuration options
 * @param {number} options.maxHoleSize - Maximum size of holes to remove (in pixels)
 * @param {number} options.threshold - Brightness threshold below which to consider as "hole" (0-255)
 * @returns {HTMLCanvasElement} The processed canvas
 */
export function removeSmallHoles(canvas, options = {}) {
  const { 
    maxHoleSize = 80,
    threshold = 50 
  } = options;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  // Create a binary mask for holes (dark regions)
  const holeMask = new Uint8Array(width * height);
  
  // Mark potential holes in the mask
  for (let i = 0; i < data.length; i += 4) {
    // Calculate brightness (simple average)
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    
    // Mark dark pixels as potential holes
    if (brightness < threshold) {
      holeMask[i / 4] = 1;
    }
  }
  
  // Find and fill small connected components
  const processed = new Uint8Array(width * height);
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  
  // Process each hole region
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Skip if not a hole or already processed
      if (holeMask[idx] === 0 || processed[idx] === 1) continue;
      
      // Find the connected hole region
      const holePixels = [];
      const borderPixels = [];
      
      // Use BFS to find connected hole pixels
      const queue = [{x, y}];
      processed[idx] = 1;
      
      while (queue.length > 0) {
        const {x: cx, y: cy} = queue.shift();
        const currentIdx = cy * width + cx;
        holePixels.push({x: cx, y: cy});
        
        // Check neighbors
        for (let i = 0; i < 4; i++) {
          const nx = cx + dx[i];
          const ny = cy + dy[i];
          
          // Skip if out of bounds
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const neighborIdx = ny * width + nx;
          
          if (holeMask[neighborIdx] === 1 && processed[neighborIdx] === 0) {
            // Another hole pixel
            queue.push({x: nx, y: ny});
            processed[neighborIdx] = 1;
          } else if (holeMask[neighborIdx] === 0) {
            // This is a border pixel (not a hole)
            borderPixels.push({x: nx, y: ny});
          }
        }
      }
      
      // Fill small holes with average border color
      if (holePixels.length < maxHoleSize && borderPixels.length > 0) {
        // Calculate average border color
        let rSum = 0, gSum = 0, bSum = 0;
        
        for (const {x: bx, y: by} of borderPixels) {
          const offset = (by * width + bx) * 4;
          rSum += data[offset];
          gSum += data[offset + 1];
          bSum += data[offset + 2];
        }
        
        const r = Math.round(rSum / borderPixels.length);
        const g = Math.round(gSum / borderPixels.length);
        const b = Math.round(bSum / borderPixels.length);
        
        // Fill the hole with the average border color
        for (const {x: hx, y: hy} of holePixels) {
          const offset = (hy * width + hx) * 4;
          data[offset] = r;
          data[offset + 1] = g;
          data[offset + 2] = b;
          // Keep the original alpha
        }
      }
    }
  }
  
  // Apply the modified data back to the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}