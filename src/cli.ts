import fs from "fs";
import path from "path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { Command } from "commander";

import { buildPathTree } from "./buildTree";
import { emitLuaClient } from "./emitLua";

type CliOptions = {
	spec: string;
	out: string;
	name: string;
};

async function generate({ spec, out, name }: CliOptions) {
	const specPath = path.resolve(spec);
	const outPath = path.resolve(out);

	console.log("Parsing OpenAPI...");
	const api = await SwaggerParser.dereference(specPath);

	const tree = buildPathTree(api.paths as any);
	const lua = emitLuaClient(tree, { clientName: name });

	const outDir = path.dirname(outPath);
	if (outDir && outDir !== ".") {
		fs.mkdirSync(outDir, { recursive: true });
	}

	fs.writeFileSync(outPath, lua);
	console.log(`Generated ${out}`);
}

export async function main(argv = process.argv) {
	const program = new Command();

	program
		.name("openapi-2-lua")
		.description("Generate a Lua API client from an OpenAPI spec")
		.option("-s, --spec <file>", "OpenAPI spec file", "openapi.json")
		.option("-o, --out <file>", "Output Lua file", "client.lua")
		.option("-n, --name <clientName>", "Lua client table name", "Client")
		.action(async opts => {
			await generate({
				spec: opts.spec,
				out: opts.out,
				name: opts.name
			});
		});

	await program.parseAsync(argv);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch(err => {
	console.error(err);
	process.exit(1);
});
