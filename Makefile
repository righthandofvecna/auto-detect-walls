

build:
	npx esbuild js/main.mjs --bundle --minify --outfile=auto-detect-walls.js

release: build
	zip module.zip -r lang styles/main.css templates auto-detect-walls.js module.json README.md LICENSE