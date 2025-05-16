
import { sceneToWalls, combineSceneWalls } from "./wall-layer.mjs";

class AutoWallsApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: "auto-walls",
      tag: "form",
      classes: ["sheet", "auto-detect-walls"],
      position: {
        height: 650,
        width: 800,
      },
      window: {
        title: "Auto Detect Walls",
        minimizable: true,
        resizable: true,
      },
      form: {
        submitOnChange: true,
        closeOnSubmit: false,
        handler: AutoWallsApplication.onSubmit,
      },
      dragDrop: [],
      actions: {
        "generate": AutoWallsApplication.generate,
        "apply": async function () {
          if (!this.walls) return ui.notifications.error("No walls generated yet");
          const autoWalls = this.scene.walls.filter(w=>w.flags["auto-detect-walls"]?.auto);
          if (autoWalls.length > 0) await this.scene.deleteEmbeddedDocuments("Wall", autoWalls.map(w=>w.id));
          await this.scene.createEmbeddedDocuments("Wall", this.walls.map((w)=>({
              c: w,
              flags: { "auto-detect-walls": { auto: true } }
          })));
          await this.close(true);
        },
      },
    },
    { inplace: false }
  );

  static PARTS = {
    controls: {
      id: "controls",
      template: "modules/auto-detect-walls/templates/scene-auto-walls.hbs",
    },
  };

  constructor(scene, options) {
    super(options);
    this.scene = scene;
    this.walls = null;

    this.k = 3; // default k for k-means clustering
    this.threshold = 32;
    this.internalWalls = false; // default to not generating internal walls
  }

  _onFirstRender(context, options) {
    AutoWallsApplication.generate.bind(this)();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.k = this.k;
    context.threshold = this.threshold;
    context.internalWalls = this.internalWalls;
    return context;
  }

  static async generate() {
    const canvas = this.element?.getElementsByTagName("canvas")?.[0] ?? null;
    this.walls = null;
    sceneToWalls(this.scene, {
      canvas,
      k: this.k,
      threshold: this.threshold,
      internalWalls: this.internalWalls,
    }).then((walls)=>{
      this.walls = walls;
    }).catch(()=>{
      ui.notifications.error("Error generating walls");
    });
  }

  static onSubmit(event, form, formData) {
    this.k = formData.object.k ?? this.k ?? 3;
    this.threshold = formData.object.threshold ?? this.threshold ?? 32;
    this.internalWalls = formData.object.internalWalls ?? this.internalWalls ?? false;
  }
}




function OnGetSceneControlButtons(controls) {
  if (foundry.utils.isNewerVersion(game.version, "13")) {
    controls.walls.tools["auto-detect-walls"] = {
      icon: "fa-solid fa-hat-wizard",
      name: "auto-detect-walls",
      title: "Auto Detect Walls",
      button: true,
      // toolclip: {
      //   heading: "Auto Detect Walls",
      //   items: [],
      // },
      onClick: ()=> new AutoWallsApplication(canvas.scene).render(true),
    }
    controls.walls.tools["minimize-walls"] = {
      icon: "fa-solid fa-gauge-max",
      name: "minimize-walls",
      title: "Minimize Walls",
      button: true,
      // toolclip: {
      //   heading: "Minimize Walls",
      //   items: [],
      // },
      onClick: ()=> combineSceneWalls(canvas.scene),
    }
  } else {
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
      onClick: ()=> new AutoWallsApplication(canvas.scene).render(true),
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
}

export function register() {
  Hooks.on("getSceneControlButtons", OnGetSceneControlButtons);
  // for testing purposes
  window.AutoWallsApplication = AutoWallsApplication;
}