# Paper Wind Studio

[한국어](README.ko.md) · [Open the live editor](https://paper-wind-studio-yuran.havoch7942.chatgpt.site)

A browser editor for a paper sheet that folds along drawn crease axes in changing wind. Switch between **English** and **한국어** with the language menu. The choice is saved in your browser.

## Use the editor

1. Choose a PNG, JPEG, or WebP image. Use a transparent PNG for irregular edges.
2. Choose **Mountain** (green solid line) or **Valley** (blue dashed line), then drag on the image to draw a fold.
3. Choose **Pin** and click to hold the sheet in place.
4. Adjust wind strength, gust variation, fold resistance, wind direction, and whole-sheet sway.
5. Use **Save project** to keep the image and settings in a JSON file. **Open project** restores it.

Images and project files are processed locally in the browser. There is no upload backend.

## Use a sheet in Godot 4

1. Click **Export for Godot**.
2. Extract the ZIP and copy the complete `paper_wind` folder into your Godot project's `res://` directory.
3. Wait for the image import, open `paper_wind/demo.tscn`, and press **F6**.
4. Instance `paper_wind/paper_wind.tscn` in your game scene. Set its transform and scale to fit the environment.
5. Change the exported wind and sway properties in the Inspector. Set `Playing` to false to stop updates.

The ZIP includes the image, a runtime script, embedded configuration, a scene, a demo scene, both English and Korean instructions, and the runtime license. Playback starts from time zero with the current editor settings. Save a separate web project JSON if you want to edit the setup later.

Godot 4.7.2 was tested. The browser and Godot simulations were compared at four checkpoints across 600 fixed steps. Position differences stayed below 0.001 Godot units. Lighting and materials are engine-specific. Godot 3 is unsupported.

## Run locally

Install Node.js, download this repository, and run from its root:

```sh
node serve.mjs
```

Open <http://127.0.0.1:8874>. No npm installation or build step is needed. ES modules need an HTTP server; opening `index.html` directly as a file is unsupported. Any static host can serve the contents of `dist/`.

```sh
node verify-model.mjs
node verify-browser-modules.mjs
```

## Model and limits

- Panels remain rigid and rotate at hinges. This is a visual model, not a general cloth solver.
- A drawn segment defines an axis extended to the sheet boundary. Local creases ending inside a face are not modeled.
- Parallel folds can move together. Crossing directions take turns to avoid stretching faces.
- A crease with pins on both sides is locked. Whole-sheet sway only works with at most one pin.
- There is no paper self-collision, thickness, tearing, or gameplay collision.
- Each playing Godot instance computes its own animation and updates its own mesh. Large groups of posters have not been performance tested.

`dist/paper-model.js` owns panel clipping and hinge transforms. `dist/app.js` owns the editor and wind timing. `dist/i18n.js` owns UI translations. `dist/godot-export.js` packages `dist/godot/paper_wind.gd` and the current data into a ZIP. The Godot runtime uses the same fixed 60 Hz equations as the browser.

## License and assets

The application code, original SVG sample, and exported Godot runtime use the [MIT License](LICENSE). Vendored Three.js keeps its [own MIT notice](dist/THREE-LICENSE.txt). The repository includes an original neutral SVG sample. The custom poster used by the hosted editor is not included or licensed by this repository. Bring your own images and retain the rights required for your use.
