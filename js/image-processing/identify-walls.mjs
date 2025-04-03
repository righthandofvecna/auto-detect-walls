

/**
 * Given a canvas that's an outline of all the walls in a dungeon, and a grid size, return the walls in the dungeon.
 * @param {*} canvas 
 */
export function identifyWalls(canvas, grid, options = {}) {
  const {
    threshold = 100,
  } = options;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  const walls = [];

  for (let y = 0; y < canvas.height; y+=grid) {
    for (let x = 0; x < canvas.width; x+=grid) {
      let mhorizontal = 0;
      let mvertical = 0;
      let horizontal = 0;
      let vertical = 0;
      for (let i = 0; i < grid; i++) {
        const indexH = (y * canvas.width + x + i) * 4;
        const indexH2 = ((y - 1) * canvas.width + x + i) * 4;
        const indexV = ((y + i) * canvas.width + x) * 4;
        const indexV2 = ((y + i) * canvas.width + (x-1)) * 4;
        if (data[indexH] >= threshold || (indexH2 >= 0 && indexH2 < data.length && data[indexH2] >= threshold)) {
          horizontal++;
          mhorizontal = Math.max(mhorizontal, horizontal);
        } else {
          horizontal = 0;
        }
        if (data[indexV] >= threshold || (indexV2 >= 0 && indexV2 < data.length && data[indexV2] >= threshold)) {
          vertical++;
          mvertical = Math.max(mvertical, vertical);
        } else {
          vertical = 0;
        }
      }
      // if horizontal
      if (mhorizontal > grid / 2) {
        walls.push([x, y, x+grid, y]);
      }
      if (mvertical > grid / 2) {
        walls.push([x, y, x, y+grid]);
      }
    }
  }
  return walls;
}

export function drawWalls(canvas, walls) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'difference';
  ctx.strokeStyle = 'grey';
  ctx.lineWidth = 4;
  for (const wall of walls) {
    const [x1, y1, x2, y2] = wall;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'normal';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  for (const wall of walls) {
    const [x1, y1, x2, y2] = wall;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}