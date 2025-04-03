/**
 * Performs k-means clustering on an image to segment it into distinct regions.
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image to segment
 * @param {number} k - The number of clusters (regions) to create
 * @param {number} maxIterations - Maximum number of iterations to perform
 * @param {number} threshold - Convergence threshold (when centroids move less than this, stop)
 */
export function kMeansImageSegmentation(canvas, options={}) {
  const {
    k = 5,
    maxIterations = 50,
    threshold = 1.0
  } = options;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  
  // Prepare pixel data as vectors in RGB space
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  
  // Initialize centroids using k-means++ method
  const centroids = initializeCentroidsKMeansPP(pixels, k);
  
  // Array to store cluster assignments for each pixel
  let clusters = new Array(pixels.length).fill(0);
  
  // Main k-means loop
  let iterations = 0;
  let converged = false;
  
  while (!converged && iterations < maxIterations) {
    // Assign pixels to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let closestCluster = 0;
      
      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = j;
        }
      }
      
      clusters[i] = closestCluster;
    }
    
    // Create new centroids by averaging
    const newCentroids = Array(k).fill().map(() => [0, 0, 0]);
    const counts = Array(k).fill(0);
    
    for (let i = 0; i < pixels.length; i++) {
      const cluster = clusters[i];
      const pixel = pixels[i];
      
      newCentroids[cluster][0] += pixel[0];
      newCentroids[cluster][1] += pixel[1];
      newCentroids[cluster][2] += pixel[2];
      counts[cluster]++;
    }
    
    // Calculate average for each centroid
    for (let i = 0; i < k; i++) {
      if (counts[i] > 0) {
        newCentroids[i][0] /= counts[i];
        newCentroids[i][1] /= counts[i];
        newCentroids[i][2] /= counts[i];
      }
    }
    
    // Check for convergence
    converged = true;
    for (let i = 0; i < k; i++) {
      if (euclideanDistance(centroids[i], newCentroids[i]) > threshold) {
        converged = false;
        break;
      }
    }
    
    // Update centroids
    centroids.splice(0, k, ...newCentroids);
    iterations++;
  }
  
  // Create segmented image
  const segmentedData = new Uint8ClampedArray(data.length);
  
  for (let i = 0; i < pixels.length; i++) {
    const cluster = clusters[i];
    const [r, g, b] = centroids[cluster].map(Math.round);
    
    const offset = i * 4;
    segmentedData[offset] = r;
    segmentedData[offset + 1] = g;
    segmentedData[offset + 2] = b;
    segmentedData[offset + 3] = data[offset + 3]; // Keep original alpha
  }
  
  // Create result image
  const result = new ImageData(segmentedData, width, height);

  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(result, 0, 0);
}

/**
 * Initialize centroids using the k-means++ algorithm
 * @param {Array<Array<number>>} pixels - Array of pixel data as RGB vectors
 * @param {number} k - Number of centroids to initialize
 * @returns {Array<Array<number>>} Initialized centroids
 */
function initializeCentroidsKMeansPP(pixels, k) {
  const centroids = [];
  
  // Choose the first centroid randomly
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push([...pixels[firstIndex]]);
  
  // Choose the remaining centroids
  for (let i = 1; i < k; i++) {
    // Calculate the squared distance from each point to its nearest centroid
    const distances = pixels.map(pixel => {
      const minDist = Math.min(...centroids.map(centroid => 
        euclideanDistance(pixel, centroid)
      ));
      return minDist * minDist; // Square the distance
    });
    
    // Calculate the sum of all distances
    const sum = distances.reduce((a, b) => a + b, 0);
    
    // Choose the next centroid with probability proportional to squared distance
    let threshold = Math.random() * sum;
    let j = 0;
    
    while (threshold > 0 && j < distances.length) {
      threshold -= distances[j];
      j++;
    }
    
    // Add the new centroid
    centroids.push([...pixels[Math.max(0, j - 1)]]);
  }
  
  return centroids;
}

/**
 * Calculates the Euclidean distance between two vectors
 * @param {Array<number>} v1 - First vector
 * @param {Array<number>} v2 - Second vector
 * @returns {number} The Euclidean distance
 */
function euclideanDistance(v1, v2) {
  return Math.sqrt(
    v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0)
  );
}
