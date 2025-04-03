
import { SceneToWallsDialog, combineSceneWalls } from "./wall-layer.mjs";

function OnGetSceneControlButtons(controls) {
  const walls = controls.find(c=>c.name === "walls");
  walls.tools.push({
    icon: "fa-solid fa-hat-wizard",
    name: "auto-detect-walls",
    title: "Auto Detect Walls",
    button: true,
    // toolclip: {
    //   heading: "Auto Detect Walls",
    //   items: [],
    // },
    onClick: ()=> SceneToWallsDialog(canvas.scene),
  });
  walls.tools.push({
    icon: "fa-solid fa-gauge-max",
    name: "minimize-walls",
    title: "Minimize Walls",
    button: true,
    // toolclip: {
    //   heading: "Minimize Walls",
    //   items: [],
    // },
    onClick: ()=> combineSceneWalls(canvas.scene),
  });
}

export function register() {
  Hooks.on("getSceneControlButtons", OnGetSceneControlButtons);
}