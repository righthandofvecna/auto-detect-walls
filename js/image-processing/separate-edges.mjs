/**
 * Reassign the regions on the canvas to separate the inside of the structures from the outside.
 * @param {*} canvas 
 * @param {*} options 
 */
export async function separateInside(canvas, options) {
  const {
    threshold = 0.4,
  } = options;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Collect edge pixels
  const edgePixels = new Map(); // Maps color string to count
  const totalEdgePixels = 2 * width + 2 * height - 4; // Subtracting corners counted twice
  
  // Check top and bottom edges
  for (let x = 0; x < width; x++) {
    // Top edge
    const topIdx = (x + 0 * width) * 4;
    const topColor = `${data[topIdx]},${data[topIdx + 1]},${data[topIdx + 2]}`;
    edgePixels.set(topColor, (edgePixels.get(topColor) || 0) + 1);
    
    // Bottom edge
    const bottomIdx = (x + (height - 1) * width) * 4;
    const bottomColor = `${data[bottomIdx]},${data[bottomIdx + 1]},${data[bottomIdx + 2]}`;
    edgePixels.set(bottomColor, (edgePixels.get(bottomColor) || 0) + 1);
  }
  
  // Check left and right edges (excluding corners already counted)
  for (let y = 1; y < height - 1; y++) {
    // Left edge
    const leftIdx = (0 + y * width) * 4;
    const leftColor = `${data[leftIdx]},${data[leftIdx + 1]},${data[leftIdx + 2]}`;
    edgePixels.set(leftColor, (edgePixels.get(leftColor) || 0) + 1);
    
    // Right edge
    const rightIdx = ((width - 1) + y * width) * 4;
    const rightColor = `${data[rightIdx]},${data[rightIdx + 1]},${data[rightIdx + 2]}`;
    edgePixels.set(rightColor, (edgePixels.get(rightColor) || 0) + 1);
  }
  
  // Find colors that exceed the threshold percentage
  const outsideColors = new Set();
  for (const [color, count] of edgePixels.entries()) {
    if (count / totalEdgePixels > threshold) {
      outsideColors.add(color);
    }
  }
  
  // Apply the transformation to the entire image
  for (let i = 0; i < data.length; i += 4) {
    const pixelColor = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    
    if (outsideColors.has(pixelColor)) {
      // Set pixels that match the outside color to black
      data[i] = 0;     // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    } else {
      // Set all other pixels to white
      data[i] = 255;     // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
      data[i + 3] = 255; // A
    }
    
    // Alpha channel remains unchanged
  }
  
  // Put the modified image data back to the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}