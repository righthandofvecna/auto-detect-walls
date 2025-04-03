import { convertToGrayscale, applyGaussianBlur } from "./ops.mjs";

/**
 * Apply Canny edge detection algorithm to a canvas
 * @param {HTMLCanvasElement} canvas - The canvas containing the image
 * @param {Object} [options] - Options for the algorithm
 * @param {number} [options.lowThreshold=10] - Low threshold for hysteresis (0-255)
 * @param {number} [options.highThreshold=30] - High threshold for hysteresis (0-255)
 * @param {number} [options.sigma=1.4] - Sigma value for Gaussian blur
 * @returns {Promise<void>} Promise that resolves when the edge detection is complete
 */
export async function cannyEdgeDetection(canvas, options = {}) {
  const { 
    lowThreshold = 40, 
    highThreshold = 70, 
    sigma = 1.4 
  } = options;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  
  console.log(`Running Canny edge detection: ${width}x${height}, thresholds: ${lowThreshold}/${highThreshold}`);
  
  // Step 1: Convert to grayscale and apply Gaussian blur
  const imageData = ctx.getImageData(0, 0, width, height);
  const grayscaleData = convertToGrayscale(imageData);
  console.log("Grayscale conversion complete");
  
  const blurredData = applyGaussianBlur(grayscaleData, sigma);
  console.log("Gaussian blur complete");
  
  // Step 2: Calculate gradients using Sobel operators
  const { gradientMagnitude, gradientDirection } = calculateGradients(blurredData);
  console.log("Gradient calculation complete");
  
  // Step 3: Apply non-maximum suppression
  const suppressedEdges = applyNonMaximumSuppression(gradientMagnitude, gradientDirection, width, height);
  console.log("Non-maximum suppression complete");

  // For debugging non-maximum suppression - now with normalization to make weak edges visible
  const suppressionDebugImageData = ctx.createImageData(width, height);
  const suppressionDebugData = suppressionDebugImageData.data;
  
  // Find max value for normalization
  let maxValue = 1; // avoid division by zero
  for (let i = 0; i < suppressedEdges.data.length; i++) {
    if (suppressedEdges.data[i] > maxValue) maxValue = suppressedEdges.data[i];
  }
  
  // Check if we have any edges
  if (maxValue <= 1) {
    throw new Error("No edges detected in the image. Please check the input image.");
  }
  
  // Show normalized suppressed edges
  for (let i = 0; i < suppressedEdges.data.length; i++) {
    const offset = i * 4;
    // Normalize to make weak edges visible
    const normValue = Math.floor(suppressedEdges.data[i] * 255 / maxValue);
    suppressionDebugData[offset] = normValue;
    suppressionDebugData[offset + 1] = normValue;
    suppressionDebugData[offset + 2] = normValue;
    suppressionDebugData[offset + 3] = 255;
  }
  
  // Apply the result to the canvas
  ctx.putImageData(suppressionDebugImageData, 0, 0);
  
  // Return here for debugging - remove this line to continue to hysteresis
  // return;
  
  // Step 4: Apply hysteresis thresholding
  const edges = applyHysteresis(suppressedEdges, lowThreshold, highThreshold);
  console.log("Hysteresis thresholding complete");
  
  // Count number of edge pixels for debugging
  let edgeCount = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] === 255) edgeCount++;
  }
  console.log(`Detected ${edgeCount} edge pixels out of ${edges.length} total pixels (${(edgeCount / edges.length * 100).toFixed(2)}%)`);
  
  // Create output image
  const outputImageData = ctx.createImageData(width, height);
  const outputData = outputImageData.data;
  
  // Set pixels: white for edges, black for non-edges
  for (let i = 0; i < edges.length; i++) {
    const offset = i * 4;
    const edgeValue = edges[i] === 255 ? 255 : 0;
    outputData[offset] = edgeValue;     // R
    outputData[offset + 1] = edgeValue; // G
    outputData[offset + 2] = edgeValue; // B
    outputData[offset + 3] = 255;       // Alpha (always fully opaque)
  }
  
  // Apply the edge detection result to the canvas
  ctx.putImageData(outputImageData, 0, 0);
  
  return canvas;
}


/**
 * Apply grayscale conversion to a canvas
 * @param {HTMLCanvasElement} canvas - The canvas to convert to grayscale
 * @returns {Promise<void>} Promise that resolves when the conversion is complete
 */
export async function applyGrayscale(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const grayscaleResult = convertToGrayscale(imageData);
  
  // Create a new ImageData object with proper RGBA format
  const outputImageData = ctx.createImageData(width, height);
  const outputData = outputImageData.data;
  
  // Convert single-channel grayscale to 4-channel RGBA
  for (let i = 0; i < grayscaleResult.data.length; i++) {
    const value = grayscaleResult.data[i];
    const offset = i * 4;
    
    outputData[offset] = value;     // R
    outputData[offset + 1] = value; // G
    outputData[offset + 2] = value; // B
    outputData[offset + 3] = 255;   // Alpha (fully opaque)
  }
  
  // Apply the grayscale result to the canvas
  ctx.putImageData(outputImageData, 0, 0);
  
  return canvas;
}

/**
 * Calculate gradient magnitude and direction using Sobel operators
 * @param {Object} imageData - The blurred grayscale image data
 * @returns {Object} Object containing gradient magnitude and direction
 */
function calculateGradients(imageData) {
  const { data, width, height } = imageData;
  const gradientMagnitude = new Uint8ClampedArray(width * height);
  const gradientDirection = new Uint8ClampedArray(width * height);
  
  // Sobel operators
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      
      // Apply Sobel operators
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += data[idx] * sobelX[kernelIdx];
          gy += data[idx] * sobelY[kernelIdx];
        }
      }
      
      // Calculate magnitude and direction
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      let angle = Math.atan2(gy, gx) * 180 / Math.PI;
      
      // Convert angle to 0, 45, 90, or 135 degrees
      if (angle < 0) angle += 180;
      
      let direction;
      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        direction = 0; // 0 degrees (horizontal)
      } else if (angle >= 22.5 && angle < 67.5) {
        direction = 45; // 45 degrees
      } else if (angle >= 67.5 && angle < 112.5) {
        direction = 90; // 90 degrees (vertical)
      } else {
        direction = 135; // 135 degrees
      }
      
      const idx = y * width + x;
      gradientMagnitude[idx] = Math.min(255, magnitude);
      gradientDirection[idx] = direction;
    }
  }
  
  return { gradientMagnitude, gradientDirection, width, height };
}

/**
 * Apply non-maximum suppression to keep only the strongest edges
 * @param {Object} gradientMagnitude - The gradient magnitude object with data, width, height
 * @param {Object} gradientDirection - The gradient direction object with data
 * @returns {Object} Suppressed edges data
 */
function applyNonMaximumSuppression(gradientMagnitude, gradientDirection, width, height) {
  const magnitudeData = gradientMagnitude.gradientMagnitude || gradientMagnitude;
  const directionData = gradientDirection.gradientDirection || gradientDirection;
  
  console.log(`Starting non-maximum suppression with dimensions: ${width}x${height}`);
  
  // Create output array
  const suppressed = new Uint8ClampedArray(width * height);
  
  // Debug counter for strong edges
  let strongPixels = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const magnitude = magnitudeData[idx];
      
      // Skip pixels with very low magnitude (likely not edges)
      if (magnitude < 10) {
        suppressed[idx] = 0;
        continue;
      }
      
      const direction = directionData[idx];
      
      let neighbor1X, neighbor1Y, neighbor2X, neighbor2Y;
      
      // Check neighbors in gradient direction
      if (direction === 0) { // Horizontal
        neighbor1X = x - 1;
        neighbor1Y = y;
        neighbor2X = x + 1;
        neighbor2Y = y;
      } else if (direction === 45) { // Diagonal (top-right to bottom-left)
        neighbor1X = x + 1;
        neighbor1Y = y - 1;
        neighbor2X = x - 1;
        neighbor2Y = y + 1;
      } else if (direction === 90) { // Vertical
        neighbor1X = x;
        neighbor1Y = y - 1;
        neighbor2X = x;
        neighbor2Y = y + 1;
      } else { // direction === 135, Diagonal (top-left to bottom-right)
        neighbor1X = x - 1;
        neighbor1Y = y - 1;
        neighbor2X = x + 1;
        neighbor2Y = y + 1;
      }
      
      // Ensure neighbors are within bounds
      neighbor1X = Math.max(0, Math.min(width - 1, neighbor1X));
      neighbor1Y = Math.max(0, Math.min(height - 1, neighbor1Y));
      neighbor2X = Math.max(0, Math.min(width - 1, neighbor2X));
      neighbor2Y = Math.max(0, Math.min(height - 1, neighbor2Y));
      
      // Get neighbor values
      const neighbor1Idx = neighbor1Y * width + neighbor1X;
      const neighbor2Idx = neighbor2Y * width + neighbor2X;
      
      const neighbor1Value = magnitudeData[neighbor1Idx];
      const neighbor2Value = magnitudeData[neighbor2Idx];
      
      // Keep the pixel if it's a local maximum
      if (magnitude >= neighbor1Value && magnitude >= neighbor2Value) {
        suppressed[idx] = magnitude;
        strongPixels++;
      } else {
        suppressed[idx] = 0;
      }
    }
  }
  
  console.log(`Non-maximum suppression: Found ${strongPixels} strong pixels out of ${width * height}`);
  
  return { data: suppressed, width, height };
}

/**
 * Apply hysteresis thresholding to connect strong edges
 * @param {Object} suppressedEdges - The suppressed edges data
 * @param {number} lowThreshold - Low threshold for hysteresis
 * @param {number} highThreshold - High threshold for hysteresis
 * @returns {Uint8ClampedArray} Final edge map
 */
function applyHysteresis(suppressedEdges, lowThreshold, highThreshold) {
  const { data, width, height } = suppressedEdges;
  const edges = new Uint8ClampedArray(width * height);
  const visited = new Uint8ClampedArray(width * height);
  
  // First pass: find strong edges
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= highThreshold) {
      edges[i] = 255; // Strong edge
      visited[i] = 1;
    }
  }
  
  // Second pass: trace weak edges connected to strong edges
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1]; // 8-connected neighbors
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  
  function trace(x, y) {
    const stack = [{x, y}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      
      for (let i = 0; i < 8; i++) {
        const nx = x + dx[i];
        const ny = y + dy[i];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIdx = ny * width + nx;
          
          if (!visited[neighborIdx] && data[neighborIdx] >= lowThreshold) {
            edges[neighborIdx] = 255;
            visited[neighborIdx] = 1;
            stack.push({x: nx, y: ny});
          }
        }
      }
    }
  }
  
  // Start tracing from strong edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] === 255 && visited[idx] === 1) {
        trace(x, y);
      }
    }
  }
  
  return edges;
}



