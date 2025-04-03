import { convertToGrayscale, applyGaussianBlur } from "./ops.mjs";

/**
 * Apply Kovalevsky edge detection algorithm to a canvas
 * @param {HTMLCanvasElement} canvas - The canvas containing the image
 * @param {Object} [options] - Options for the algorithm
 * @param {number} [options.threshold=25] - Threshold for edge detection (0-255)
 * @param {boolean} [options.thinning=true] - Apply edge thinning
 * @returns {Promise<HTMLCanvasElement>} The canvas with detected edges
 */
export async function kovalevskiyEdgeDetection(canvas, options = {}) {
  const { 
    threshold = 25,
    thinning = true
  } = options;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  
  console.log(`Running Kovalevsky edge detection: ${width}x${height}, threshold: ${threshold}`);
  
  // Step 1: Convert to grayscale
  const imageData = ctx.getImageData(0, 0, width, height);
  const grayscaleData = convertToGrayscale(imageData);
  console.log("Grayscale conversion complete");
  
  // Step 2: Apply Gaussian blur to reduce noise
  const blurredData = applyGaussianBlur(grayscaleData, 1.0);
  console.log("Gaussian blur complete");
  
  // Step 3: Apply gradient operator (improved version)
  const gradientMagnitude = calculateImprovedGradient(blurredData);
  console.log("Gradient calculation complete");
  
  // Step 4: Apply threshold and topology-preserving thinning
  const edges = applyEdgeExtraction(gradientMagnitude, threshold, thinning);
  console.log("Edge extraction complete");
  
  // Create output image
  const outputImageData = ctx.createImageData(width, height);
  const outputData = outputImageData.data;
  
  // Set pixels: white for edges, black for non-edges
  for (let i = 0; i < edges.length; i++) {
    const offset = i * 4;
    const edgeValue = edges[i] ? 255 : 0;
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
 * Calculate improved gradient for Kovalevsky edge detection
 * @param {Object} imageData - The grayscale image data
 * @returns {Object} Object containing gradient data
 */
function calculateImprovedGradient(imageData) {
  const { data, width, height } = imageData;
  const gradientMagnitude = new Uint8ClampedArray(width * height);
  
  // Define the compass operators for better edge detection
  // Roberts Cross operators
  const gx = [
    [1, 0],
    [0, -1]
  ];
  
  const gy = [
    [0, 1],
    [-1, 0]
  ];
  
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      // Apply Roberts Cross operator
      let rxVal = 0;
      let ryVal = 0;
      
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const pixelIdx = (y + j) * width + (x + i);
          rxVal += data[pixelIdx] * gx[j][i];
          ryVal += data[pixelIdx] * gy[j][i];
        }
      }
      
      // Calculate gradient magnitude
      const gradMag = Math.sqrt(rxVal * rxVal + ryVal * ryVal);
      
      // Store the gradient
      gradientMagnitude[y * width + x] = Math.min(255, gradMag);
    }
  }
  
  // Add additional edge detection for right and bottom borders
  for (let y = 0; y < height - 1; y++) {
    const x = width - 1;
    const leftPixel = data[y * width + (x - 1)];
    const centerPixel = data[y * width + x];
    const belowPixel = data[(y + 1) * width + x];
    gradientMagnitude[y * width + x] = Math.min(255, 
      Math.abs(centerPixel - leftPixel) + Math.abs(centerPixel - belowPixel)
    );
  }
  
  for (let x = 0; x < width - 1; x++) {
    const y = height - 1;
    const abovePixel = data[(y - 1) * width + x];
    const centerPixel = data[y * width + x];
    const rightPixel = data[y * width + (x + 1)];
    gradientMagnitude[y * width + x] = Math.min(255, 
      Math.abs(centerPixel - abovePixel) + Math.abs(centerPixel - rightPixel)
    );
  }
  
  // Bottom-right corner
  const y = height - 1;
  const x = width - 1;
  const leftPixel = data[y * width + (x - 1)];
  const abovePixel = data[(y - 1) * width + x];
  const centerPixel = data[y * width + x];
  gradientMagnitude[y * width + x] = Math.min(255, 
    Math.abs(centerPixel - leftPixel) + Math.abs(centerPixel - abovePixel)
  );
  
  return { data: gradientMagnitude, width, height };
}

/**
 * Apply edge extraction with non-maximum suppression and hysteresis
 * @param {Object} gradientData - The gradient magnitude data
 * @param {number} threshold - Threshold for edge detection
 * @param {boolean} thinning - Whether to apply edge thinning
 * @returns {Uint8ClampedArray} The binary edge map
 */
function applyEdgeExtraction(gradientData, threshold, thinning) {
  const { data, width, height } = gradientData;
  const edges = new Uint8ClampedArray(width * height);
  
  // Apply simple thresholding first
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= threshold) {
      edges[i] = 1;
    }
  }
  
  // Apply edge thinning if requested
  if (thinning) {
    const thinned = applyEdgeThinning(edges, width, height);
    // Copy thinned edges back to original array
    for (let i = 0; i < edges.length; i++) {
      edges[i] = thinned[i];
    }
  }
  
  // Apply hysteresis to connect broken edges
  const finalEdges = new Uint8ClampedArray(width * height);
  const visited = new Uint8ClampedArray(width * height);
  
  // Define the 8-connected neighborhood
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  
  // First detect all strong edge points
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] === 1) {
        // Check if it's a strong edge (has multiple edge neighbors)
        let edgeNeighbors = 0;
        for (let i = 0; i < 8; i++) {
          const nx = x + dx[i];
          const ny = y + dy[i];
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIdx = ny * width + nx;
            if (edges[neighborIdx] === 1) {
              edgeNeighbors++;
            }
          }
        }
        
        if (edgeNeighbors >= 2) {
          finalEdges[idx] = 1;
          visited[idx] = 1;
        }
      }
    }
  }
  
  // Now trace from strong edges to complete lines
  function traceEdge(x, y) {
    const stack = [{x, y}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      
      for (let i = 0; i < 8; i++) {
        const nx = x + dx[i];
        const ny = y + dy[i];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIdx = ny * width + nx;
          
          if (!visited[neighborIdx] && edges[neighborIdx] === 1) {
            finalEdges[neighborIdx] = 1;
            visited[neighborIdx] = 1;
            stack.push({x: nx, y: ny});
          }
        }
      }
    }
  }
  
  // Start tracing from each strong edge
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (finalEdges[idx] === 1 && visited[idx] === 1) {
        traceEdge(x, y);
      }
    }
  }
  
  // Include any remaining unvisited edge pixels
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] === 1 && !visited[i]) {
      // Check if isolated point has at least one adjacent edge
      const y = Math.floor(i / width);
      const x = i % width;
      
      let hasAdjacent = false;
      for (let j = 0; j < 8; j++) {
        const nx = x + dx[j];
        const ny = y + dy[j];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIdx = ny * width + nx;
          if (finalEdges[neighborIdx] === 1) {
            hasAdjacent = true;
            break;
          }
        }
      }
      
      if (hasAdjacent) {
        finalEdges[i] = 1;
      }
    }
  }
  
  return finalEdges;
}

/**
 * Apply edge thinning to create 1-pixel wide edges
 * @param {Uint8ClampedArray} edges - The binary edge map
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} Thinned edge map
 */
function applyEdgeThinning(edges, width, height) {
  const result = new Uint8ClampedArray(edges);
  const temp = new Uint8ClampedArray(width * height);
  let changed = true;
  const iterations = 10; // Limit iterations to avoid infinite loop
  let iteration = 0;
  
  // Define patterns for thinning (Zhang-Suen algorithm)
  function isRemovable(p, phase) {
    // For 3x3 neighborhood around p:
    // p9 p2 p3
    // p8 p1 p4
    // p7 p6 p5
    
    const x = p % width;
    const y = Math.floor(p / width);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return false;
    
    const p1 = result[p];
    if (p1 !== 1) return false;
    
    const p2 = result[(y-1) * width + x];
    const p3 = result[(y-1) * width + (x+1)];
    const p4 = result[y * width + (x+1)];
    const p5 = result[(y+1) * width + (x+1)];
    const p6 = result[(y+1) * width + x];
    const p7 = result[(y+1) * width + (x-1)];
    const p8 = result[y * width + (x-1)];
    const p9 = result[(y-1) * width + (x-1)];
    
    const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
    
    // Count transitions from 0 to 1
    let transitions = 0;
    for (let i = 0; i < 7; i++) {
      if (neighbors[i] === 0 && neighbors[i+1] === 1) transitions++;
    }
    if (neighbors[7] === 0 && neighbors[0] === 1) transitions++;
    
    // Count non-zero neighbors
    const nonZeroNeighbors = neighbors.filter(n => n === 1).length;
    
    // Phase 1 conditions
    if (phase === 0) {
      return transitions === 1 && 
             nonZeroNeighbors >= 2 && nonZeroNeighbors <= 6 &&
             p2 * p4 * p6 === 0 && 
             p4 * p6 * p8 === 0;
    } 
    // Phase 2 conditions
    else {
      return transitions === 1 && 
             nonZeroNeighbors >= 2 && nonZeroNeighbors <= 6 &&
             p2 * p4 * p8 === 0 && 
             p2 * p6 * p8 === 0;
    }
  }
  
  while (changed && iteration < iterations) {
    changed = false;
    iteration++;
    
    // Phase 1
    for (let i = 0; i < result.length; i++) {
      if (isRemovable(i, 0)) {
        temp[i] = 1;
        changed = true;
      }
    }
    
    for (let i = 0; i < result.length; i++) {
      if (temp[i] === 1) {
        result[i] = 0;
        temp[i] = 0;
      }
    }
    
    // Phase 2
    for (let i = 0; i < result.length; i++) {
      if (isRemovable(i, 1)) {
        temp[i] = 1;
        changed = true;
      }
    }
    
    for (let i = 0; i < result.length; i++) {
      if (temp[i] === 1) {
        result[i] = 0;
        temp[i] = 0;
      }
    }
  }
  
  return result;
}