import { defineConfig } from "tsup";
import { peerDependencies } from "./package.json";
import ts, { JsxEmit } from "typescript";
// @ts-ignore
const blip = (await import("ts-transformer-keys/transformer.js")).default.default;
export default defineConfig((options) => {
	const dev = !!options.watch;
	const loader: (typeof options)["loader"] = {
		".ts": "tsx",
		".tsx": "tsx",
		".jsx": "jsx",
		".js": "jsx",
	};
	return {
		entry: ["src/**/index.(ts|js|tsx|jsx)", "src/endpoints/**/*.(ts|js|tsx|jsx)"],
		loader,
		format: ["esm"],
		target: "node18",
		treeshake: true,
		bundle: true,
		dts: true,
		sourcemap: dev,
		clean: !dev,
		splitting: false,
		minify: !dev,
		external: [
			...Object.keys(peerDependencies),
			"astro:content",
			"astro:prefetch",
			"astro:transitions/client",
		],
		tsconfig: "tsconfig.json",
		cjsInterop: true,
		jsxFactory: "React.createElement",
		jsxFragment: "React.Fragment",
		esbuildOptions: (options) => {
			// console.log("exb", options);
			options.jsxSideEffects = true;
			options.jsx = "transform";
			options.jsxImportSource = "react";
			if (!options.loader) options.loader = {};
			options.loader![".js"] = "jsx";
			// console.log(options.loader);
		},
		esbuildPlugins: [
			/* {
				name: "keys",
				setup(build) {
					build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
						const configFileName = ts.findConfigFile(
							"./",
							ts.sys.fileExists,
							"tsconfig.json"
						);
						const configFile = ts.readConfigFile(
							configFileName!,
							ts.sys.readFile
						);
						const compilerOptions = ts.parseJsonConfigFileContent(
							configFile.config,
							ts.sys,
							"./"
						);
						const program = ts.createProgram(
							[args.path],
							compilerOptions.options
						);
						const transformers = {
							before: [blip(program)],
							after: [],
						};
						const files: Record<string, string> = {};
						const { emitSkipped, diagnostics } = program.emit(
							undefined,
							(fn, txt, _, __) => {
								files[fn] = txt
							},
							undefined,
							false,
							transformers
						);
						// console.log(files)
						if (emitSkipped) {
							throw new Error(
								diagnostics
									.map((diagnostic) => diagnostic.messageText)
									.join("\n")
							);
						}
						return {
							contents: files[args.path.replace(/\.ts(x?)$/, ".js$1")],
						};
					});
				},
			} */
		],
		// esbuildPlugins: [esbuildPluginTsc({tsx: true})]
	};
});
