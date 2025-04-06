
release:
	mv auto-detect-walls.js auto-detect-walls-temp.js
	npx esbuild js/main.mjs --bundle --minify --outfile=auto-detect-walls.js
	zip module.zip -r lang styles/main.css templates auto-detect-walls.js module.json README.md LICENSE
	mv auto-detect-walls-temp.js auto-detect-walls.js
