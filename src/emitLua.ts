import type { MethodsMap, PathTreeNode } from "./buildTree";

export function emitLuaClient(tree: PathTreeNode, options: { clientName?: string } = {}): string {
	const lines: string[] = [];
	const clientName = toLuaIdentifier(options.clientName || "Client");

	lines.push(`local ${clientName} = {}`);
	lines.push(`${clientName}.__index = ${clientName}`);
	lines.push("");
	lines.push(`function ${clientName}:new(config)`);
	lines.push("  local instance = {");
	lines.push("    baseUrl = config.baseUrl,");
	lines.push("    request = config.request");
	lines.push("  }");
	lines.push("");
	lines.push("  setmetatable(instance, self)");
	lines.push("");

	emitNode(lines, "instance", tree, 2);

	lines.push("");
	lines.push("  return instance");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:_request(options)`);
	lines.push("  options = options or {}\n");
	lines.push("  return self.request {");
	lines.push("    url = self.baseUrl .. options.url,");
	lines.push("    body = options.body,");
	lines.push("    headers = options.headers,");
	lines.push("    binary = options.binary,");
	lines.push("    method = options.method,");
	lines.push("    redirect = options.redirect,");
	lines.push("    timeout = options.timeout");
	lines.push("  }");
	lines.push("end");
	lines.push("");
	lines.push(`return ${clientName}`);

	return lines.join("\n");
}

const LUA_KEYWORDS = new Set([
	"and",
	"break",
	"do",
	"else",
	"elseif",
	"end",
	"false",
	"for",
	"function",
	"goto",
	"if",
	"in",
	"local",
	"nil",
	"not",
	"or",
	"repeat",
	"return",
	"then",
	"true",
	"until",
	"while"
]);

function isLuaIdentifier(key: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_KEYWORDS.has(key);
}

function luaStringLiteral(value: string): string {
	return (
		'"' +
		String(value)
			.replace(/\\/g, "\\\\")
			.replace(/\r/g, "\\r")
			.replace(/\n/g, "\\n")
			.replace(/\t/g, "\\t")
			.replace(/\"/g, '\\"') +
		'"'
	);
}

function luaChildRef(parentRef: string, key: string): string {
	return isLuaIdentifier(key) ? `${parentRef}.${key}` : `${parentRef}[${luaStringLiteral(key)}]`;
}

function toLuaIdentifier(rawName: string): string {
	let name = String(rawName)
		.replace(/[^A-Za-z0-9_]/g, "_")
		.replace(/^\d+/, match => "_" + match);

	if (!name) name = "param";
	if (LUA_KEYWORDS.has(name)) name = `${name}_`;
	return name;
}

function makeUniqueLuaParams(rawParams: string[]): { mapping: Record<string, string>; ordered: string[] } {
	const mapping: Record<string, string> = {};
	const used = new Set<string>();
	const ordered: string[] = [];

	for (const raw of rawParams) {
		let candidate = toLuaIdentifier(raw);
		let i = 2;
		while (used.has(candidate)) {
			candidate = `${toLuaIdentifier(raw)}_${i++}`;
		}
		used.add(candidate);
		mapping[raw] = candidate;
		ordered.push(candidate);
	}

	return { mapping, ordered };
}

function emitNode(lines: string[], parentName: string, node: PathTreeNode, indentLevel: number) {
	const indent = "  ".repeat(indentLevel);

	for (const [key, value] of Object.entries(node)) {
		if (key === "__methods") continue;
		if (!value || typeof value !== "object") continue;

		const childRef = luaChildRef(parentName, key);
		lines.push(`${indent}${childRef} = {}`);
		emitNode(lines, childRef, value.children as PathTreeNode, indentLevel);
	}

	if (node.__methods) {
		emitMethods(lines, parentName, node.__methods, indentLevel);
	}
}

function emitMethods(lines: string[], tableName: string, methods: MethodsMap, indentLevel: number) {
	const indent = "  ".repeat(indentLevel);

	for (let [method, data] of Object.entries(methods)) {
		const { mapping: paramNameMap, ordered: luaParams } = makeUniqueLuaParams(data.pathParams);
		const params = luaParams.length > 0 ? `${luaParams.join(", ")}, options` : "options";

		method = method.replace(/@/g, "");

		lines.push("");
		lines.push(`${indent}${tableName}.${method} = function(${params})`);
		lines.push(`${indent}  options = options or {}`);
		lines.push(`${indent}  return self:_request {`);
		lines.push(`${indent}    url = "${buildLuaPath(data.fullPath, paramNameMap)}",`);
		lines.push(`${indent}    method = "${method.toUpperCase()}",`);
		lines.push(`${indent}    body = options.body,`);
		lines.push(`${indent}    headers = options.headers,`);
		lines.push(`${indent}    binary = options.binary,`);
		lines.push(`${indent}    redirect = options.redirect,`);
		lines.push(`${indent}    timeout = options.timeout`);
		lines.push(`${indent}  }`);
		lines.push(`${indent}end`);
	}
}

function buildLuaPath(path: string, paramNameMap: Record<string, string> = {}): string {
	return path.replace(/{(.+?)}/g, (_, rawName: string) => `" .. ${paramNameMap[rawName] || rawName} .. "`);
}
