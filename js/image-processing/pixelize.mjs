/**
 * Pixelizes an image using a nearest neighbor strategy
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image to pixelize
 * @param {Object} options - Configuration options
 * @param {number} options.cellSize - The size of each pixelized cell in pixels
 * @param {boolean} options.preserveCanvas - If true, returns a new canvas instead of modifying the input
 * @returns {HTMLCanvasElement} The pixelized canvas (either the input or a new one)
 */
export function pixelizeNearest(canvas, options = {}) {
  const { 
    cellSize = 8,  // Default to 8×8 pixel cells
    preserveCanvas = false
  } = options;
  
  // Validate inputs
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Invalid canvas element');
  }
  
  if (cellSize < 1) {
    throw new Error('Cell size must be at least 1 pixel');
  }
  
  // Original dimensions
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;
  
  // Target canvas (either the input canvas or a new one)
  const targetCanvas = preserveCanvas 
    ? document.createElement('canvas') 
    : canvas;
  
  if (preserveCanvas) {
    targetCanvas.width = originalWidth;
    targetCanvas.height = originalHeight;
  }
  
  // Get the contexts for reading and writing
  const sourceCtx = canvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  
  // Get the original image data
  const imageData = sourceCtx.getImageData(0, 0, originalWidth, originalHeight);
  const { data } = imageData;
  
  // Calculate the dimensions in terms of cells
  const cellsX = Math.ceil(originalWidth / cellSize);
  const cellsY = Math.ceil(originalHeight / cellSize);
  
  console.log(`Pixelizing image: ${originalWidth}x${originalHeight} to ${cellsX}x${cellsY} cells (cell size: ${cellSize}px)`);

  // Loop through each cell
  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      // Calculate the bounds of the current cell
      const startX = x * cellSize;
      const startY = y * cellSize;
      const endX = Math.min(startX + cellSize, originalWidth);
      const endY = Math.min(startY + cellSize, originalHeight);
      
      // Calculate the most common color in the cell
      const colors = {};
      for (let cellY = startY; cellY < endY; cellY++) {
        for (let cellX = startX; cellX < endX; cellX++) {
          const index = (cellY * originalWidth + cellX) * 4;
          const fs = `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, 1)`;
          colors[fs] ??= 0;
          colors[fs]++;
        }
      }
      // get the most common color
      let maxCount = 0;
      let mostCommonColor = null;
      for (const color in colors) {
        if (colors[color] > maxCount) {
          maxCount = colors[color];
          mostCommonColor = color;
        }
      }
      // Set the most common color for the cell
      targetCtx.fillStyle = mostCommonColor;
      targetCtx.fillRect(startX, startY, endX - startX, endY - startY);
    }
  }
  
  
  
  return targetCanvas;
}