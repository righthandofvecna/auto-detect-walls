
import * as controls from "./controls.mjs";
import * as wallLayer from "./wall-layer.mjs";

function early_isGM() {
	const level = game.data.users.find(u => u._id == game.data.userId).role;
	const gmLevel = CONST.USER_ROLES.ASSISTANT;
	return level >= gmLevel;
}

Hooks.on("init", () => {
  if (!early_isGM()) return;
  controls.register();
  wallLayer.register();
});