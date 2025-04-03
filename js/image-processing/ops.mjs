/**
 * @param {String} imageUrl - The URL of the image to load
 * @param {number} [scale=1] - Scale factor to resize the image (0.5 = half size, 0.25 = quarter size, etc.)
 * @returns {Promise<HTMLCanvasElement>} Canvas with the loaded image
 */
export async function imageToCanvas(imageUrl, options = {}) {
  if (!imageUrl) {
    throw new Error("Invalid image binary data");
  }
  const {
    width = 4000,
    height = 4000,
    scaledWidth = 4000,
    scaledHeight = 4000,
    imgOffsetX = 0,
    imgOffsetY = 0,
  } = options;
  
  // Load the image
  const image = await createImageBitmap(await fetch(imageUrl).then(r => r.blob()));
  URL.revokeObjectURL(imageUrl);
  
  // Create a canvas to work with the image data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Draw the image on canvas with scaling
  ctx.drawImage(image, imgOffsetX, imgOffsetY, scaledWidth, scaledHeight);

  // TODO: fill the possibly empty borders if there's an offset

  return canvas;
}



/**
 * Convert image data to grayscale
 * @param {ImageData} imageData - The original image data
 * @returns {Uint8ClampedArray} Grayscale image data (single channel)
 */
export function convertToGrayscale(imageData) {
  const { data, width, height } = imageData;
  const grayscale = new Uint8ClampedArray(width * height);
  
  for (let i = 0; i < data.length; i += 4) {
    // Standard luminance formula
    const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscale[i / 4] = value;
  }
  
  return { data: grayscale, width, height };
}


/**
 * Apply Gaussian blur to grayscale image data
 * @param {Object} imageData - The grayscale image data
 * @param {number} sigma - Sigma value for Gaussian kernel
 * @returns {Uint8ClampedArray} Blurred image data
 */
export function applyGaussianBlur(imageData, sigma) {
  const { data, width, height } = imageData;
  const kernelSize = Math.max(3, Math.ceil(sigma * 3) * 2 + 1);
  const halfSize = Math.floor(kernelSize / 2);
  
  // Create Gaussian kernel
  const kernel = new Float32Array(kernelSize);
  let sum = 0;
  
  for (let i = 0; i < kernelSize; i++) {
    const x = i - halfSize;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  
  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }
  
  // Apply horizontal blur
  const tempData = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -halfSize; k <= halfSize; k++) {
        const xPos = Math.min(Math.max(x + k, 0), width - 1);
        sum += data[y * width + xPos] * kernel[k + halfSize];
      }
      tempData[y * width + x] = sum;
    }
  }
  
  // Apply vertical blur
  const blurredData = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -halfSize; k <= halfSize; k++) {
        const yPos = Math.min(Math.max(y + k, 0), height - 1);
        sum += tempData[yPos * width + x] * kernel[k + halfSize];
      }
      blurredData[y * width + x] = sum;
    }
  }
  
  return { data: blurredData, width, height };
}

/**
 * Apply a median filter to a canvas
 * @param {ArrayBuffer} canvas - The canvas containing the image
 * @param {number} [kernelSize=3] - Size of the median filter kernel (must be odd)
 * @returns {Promise<ArrayBuffer>} The filtered image as binary data
 */
export async function applyMedianFilter(canvas, kernelSize = 3) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  
  // Validate kernel size (must be odd)
  if (kernelSize % 2 === 0) kernelSize++;
  const halfKernel = Math.floor(kernelSize / 2);
  
  // Create output buffer
  const outputData = new Uint8ClampedArray(data.length);
  
  // Apply median filter using median pixel (not per-channel)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixels = [];
      
      // Gather all pixels within the kernel
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const pixelX = Math.min(Math.max(x + kx, 0), width - 1);
          const pixelY = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (pixelY * width + pixelX) * 4;
          
          // Store the complete pixel (R,G,B values) and its position
          pixels.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3],
            // Calculate luminance for sorting (standard formula)
            luminance: 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
            sourceIdx: idx
          });
        }
      }
      
      // Sort pixels by luminance
      pixels.sort((a, b) => a.luminance - b.luminance);
      
      // Get the median pixel
      const medianPixel = pixels[Math.floor(pixels.length / 2)];
      
      // Set the output pixel with all channels from the median pixel
      const outputIdx = (y * width + x) * 4;
      outputData[outputIdx] = medianPixel.r;
      outputData[outputIdx + 1] = medianPixel.g;
      outputData[outputIdx + 2] = medianPixel.b;
      outputData[outputIdx + 3] = medianPixel.a;
    }
  }
  
  // Wipe the canvas and put the new image data
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(new ImageData(outputData, width, height), 0, 0);
}

/**
 * Apply a median filter to a canvas
 * @param {ArrayBuffer} canvas - The canvas containing the image
 * @param {number} [kernelSize=3] - Size of the median filter kernel (must be odd)
 * @returns {Promise<ArrayBuffer>} The filtered image as binary data
 */
export async function applyBrightenFilter(canvas, kernelSize = 3) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  
  // Validate kernel size (must be odd)
  if (kernelSize % 2 === 0) kernelSize++;
  const halfKernel = Math.floor(kernelSize / 2);
  
  // Create output buffer
  const outputData = new Uint8ClampedArray(data.length);
  
  // Apply median filter using median pixel (not per-channel)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let brighten = false;
      
      // Gather all pixels within the kernel
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const pixelX = Math.min(Math.max(x + kx, 0), width - 1);
          const pixelY = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (pixelY * width + pixelX) * 4;
          
          // Store the complete pixel (R,G,B values) and its position
          let luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (luminance > 0) {
            brighten = true;
            break;
          }
        }
        if (brighten) {
          break;
        }
      }
      const outputIdx = (y * width + x) * 4;
      if (brighten) {
        outputData[outputIdx] = 255;
        outputData[outputIdx + 1] = 255;
        outputData[outputIdx + 2] = 255;
        outputData[outputIdx + 3] = 255;
      } else {
        outputData[outputIdx] = 0;
        outputData[outputIdx + 1] = 0;
        outputData[outputIdx + 2] = 0;
        outputData[outputIdx + 3] = 0;
      }
    }
  }
  
  // Wipe the canvas and put the new image data
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(new ImageData(outputData, width, height), 0, 0);
}

export function newCanvas(canvas, imageData) {
  const { width, height } = canvas;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

  ctx.putImageData(imageData, 0, 0);
  return tempCanvas;
}

/**
 * Apply an imageData to a canvas with a specific composite operation
 * @param {*} canvas 
 * @param {*} imageData 
 * @param {*} op 
 */
export async function applyWithOp(canvas, imageData, op) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tempCanvas = newCanvas(canvas, imageData);
  const oldop = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = op;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.globalCompositeOperation = oldop;
}

