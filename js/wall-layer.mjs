import * as imp from "./image-processing/_module.mjs";


export async function sceneToWalls(scene, options = {}) {
  // infer a bunch of things from the scene
  const { width, height, cellSize, imgWidth, imgHeight, resolutionScale } = (()=>{
    const grid = scene.grid.size || scene.grid.gridX || 100; // default to 100px grid size
    const w = scene.width;
    const h = scene.height;
    const subCellScale = Math.max(options.subCellScale || 1, 1);
    let resolutionScale = Math.round(Math.max(options.resolutionScale ?? (grid / (subCellScale * 7)), 1));
    // pick a resolutionScale that makes the cellSize an integer
    while (resolutionScale > 1 && ((grid / (resolutionScale * subCellScale)) % 1 > (1 / Math.max(w * subCellScale / grid, h * subCellScale / grid)))) {
      resolutionScale -= 1;
      console.log("Adjusted resolutionScale to", resolutionScale);
    }
    const cellSize = Math.floor(grid / (resolutionScale * subCellScale));
    const imgWidth = Math.floor(w / resolutionScale);
    const imgHeight = Math.floor(h / resolutionScale);
    const mapWidth = Math.floor(imgWidth / cellSize) * cellSize;
    const mapHeight = Math.floor(imgHeight / cellSize) * cellSize;

    return {
      width: mapWidth,
      height: mapHeight,
      cellSize,
      imgWidth,
      imgHeight,
      resolutionScale,
    }
  })();
  const {
    canvas = null,
    internalWalls = false,
    k = 10,
    colorThreshold = 32,
    // debug
    nowalls = false,
    edgeDetection = true,
    pixelize = true,
  } = options;
  const bkgimgcanvas = await imp.imageToCanvas(scene.background.src, {
    width,
    height,
    scaledWidth: imgWidth,
    scaledHeight: imgHeight,
    // imgOffsetX = 0,
    // imgOffsetY = 0,
  });
  const ctx = bkgimgcanvas.getContext('2d', { willReadFrequently: true });
  const original = ctx.getImageData(0, 0, width, height);
  imp.kMeansImageSegmentation(bkgimgcanvas, { k })
  if (pixelize) {
    imp.separateInside(bkgimgcanvas, { colorThreshold, threshold: 0.4 }); // TODO: threshold should be based on K?
    await imp.applyMedianFilter(bkgimgcanvas, 5);
    imp.pixelizeNearest(bkgimgcanvas, { cellSize });
  }

  // Find the edges of the squares
  if (edgeDetection) {
    await imp.kovalevskiyEdgeDetection(bkgimgcanvas, { thinning: false });
    await imp.applyMedianFilter(bkgimgcanvas, 3);
  }

  if (internalWalls) {
    const edgeDetection = imp.newCanvas({ width, height }, original);
    await imp.kovalevskiyEdgeDetection(edgeDetection, { thinning: true });
    imp.applyWithOp(bkgimgcanvas, edgeDetection.getContext('2d', { willReadFrequently: true }).getImageData(0,0,width,height), "lighten");
    imp.applyBrightenFilter(bkgimgcanvas, 3);
  }

  const walls = imp.identifyWalls(bkgimgcanvas, cellSize, { threshold: 50 });
  if (!nowalls) {
    ctx.fillRect(0, 0, width, height, "black");
    ctx.putImageData(original, 0, 0);
    imp.drawWalls(bkgimgcanvas, walls);
  }

  if (canvas) {
    const cvCtx = canvas.getContext('2d');
    // canvas.width = width;
    canvas.height = Math.round(canvas.width * (height / width));
    cvCtx.drawImage(bkgimgcanvas, 0, 0, canvas.width, canvas.height);
  }
  const offsetX = scene.dimensions.sceneX; // subtract the background offset too
  const offsetY = scene.dimensions.sceneY; // subtract the background offset too
  return walls.map(w=>w.map((c, idx)=>c * resolutionScale + (idx % 2 == 0 ? offsetX : offsetY)));
}

export async function combineSceneWalls(scene) {
  // find all the walls in the scene that are just basic walls
  const walls = scene.walls.filter(w=>
    w.door == CONST.WALL_DOOR_TYPES.NONE &&
    w.dir == CONST.WALL_DIRECTIONS.BOTH &&
    w.light == CONST.WALL_SENSE_TYPES.NORMAL &&
    w.sight == CONST.WALL_SENSE_TYPES.NORMAL && 
    w.sound == CONST.WALL_SENSE_TYPES.NORMAL &&
    w.move == CONST.WALL_MOVEMENT_TYPES.NORMAL &&
    !w.threshold.attenuation &&
    w.threshold.light == null &&
    w.threshold.sight == null &&
    w.threshold.sound == null
  );
  const wallMap = {};
  const wallIdToAB = {};
  walls.forEach(w=>{
    const c = w.c;
    const dir = Math.round(Math.atan2(Math.abs(c[3] - c[1]), Math.abs(c[2] - c[0])) * 30);
    const a = `${Math.round(c[0])},${Math.round(c[1])},${dir}`;
    const b = `${Math.round(c[2])},${Math.round(c[3])},${dir}`;
    wallMap[a] ??= new Set();
    wallMap[b] ??= new Set();
    wallMap[a].add(w);
    wallMap[b].add(w);
    wallIdToAB[w.id] = [a, b];
  });

  // build up sets of a/b that are connected
  const wallSets = [];
  const visitedK = new Set();
  const visit = function(w, set) {
    set.add(w);
    const [a, b] = wallIdToAB[w.id];
    if (!visitedK.has(a)) {
      visitedK.add(a);
      wallMap[a].forEach(w=>visit(w, set));
    };
    if (!visitedK.has(b)) {
      visitedK.add(b);
      wallMap[b].forEach(w=>visit(w, set));
    };
  }
  for (const [k, v] of Object.entries(wallMap)) {
    if (visitedK.has(k)) continue;
    const set = new Set();
    for (const w of v) {
      visit(w, set);
    }
    wallSets.push(set);
  }

  const newWalls = [];
  for (const set of wallSets) {
    // for each set, find the min and max x/y coords
    const coords = [...set].map(k=>k.c);
    const x1 = Math.min(...coords.map(c=>Math.min(c[0], c[2])));
    const y1 = Math.min(...coords.map(c=>Math.min(c[1], c[3])));
    const x2 = Math.max(...coords.map(c=>Math.max(c[0], c[2])));
    const y2 = Math.max(...coords.map(c=>Math.max(c[1], c[3])));
    newWalls.push([x1,y1, x2, y2]);
  }

  // delete the old walls
  await scene.deleteEmbeddedDocuments("Wall", walls.map(w=>w.id));
  // create the new walls
  await scene.createEmbeddedDocuments("Wall", newWalls.map((w)=>({
      c: w,
      flags: { "auto-detect-walls": { auto: true } }
  })));

}
