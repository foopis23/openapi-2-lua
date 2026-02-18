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
	lines.push("    baseHeaders = config.baseHeaders or {},");
	lines.push("    request = config.request");
	lines.push("  }");
	lines.push("");
	lines.push("  setmetatable(instance, self)");
	lines.push("");

	emitNode(lines, "instance", tree, 2, "instance");

	lines.push("");
	lines.push("  return instance");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:setBaseHeaders(headers)`);
	lines.push("  self.baseHeaders = headers or {}");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:setBaseHeader(name, value)`);
	lines.push("  if not self.baseHeaders then self.baseHeaders = {} end");
	lines.push("  self.baseHeaders[name] = value");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:removeBaseHeader(name)`);
	lines.push("  if not self.baseHeaders then return end");
	lines.push("  self.baseHeaders[name] = nil");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:_request(options)`);
	lines.push("  options = options or {}\n");
	lines.push("  local url = options.url or \"\"");
	lines.push("  local query = options.query");
	lines.push("  if query ~= nil then");
	lines.push("    local queryString = self:_buildQueryString(query)");
	lines.push("    if queryString ~= \"\" then");
	lines.push("      local separator = string.find(url, \"?\", 1, true) and \"&\" or \"?\"");
	lines.push("      url = url .. separator .. queryString");
	lines.push("    end");
	lines.push("  end\n");
	lines.push("  local headers = nil");
	lines.push("  if self.baseHeaders ~= nil or options.headers ~= nil then");
	lines.push("    headers = {}");
	lines.push("    for k, v in pairs(self.baseHeaders or {}) do");
	lines.push("      headers[k] = v");
	lines.push("    end");
	lines.push("    for k, v in pairs(options.headers or {}) do");
	lines.push("      headers[k] = v");
	lines.push("    end");
	lines.push("  end\n");
	lines.push("  return self.request {");
	lines.push("    url = self.baseUrl .. url,");
	lines.push("    body = options.body,");
	lines.push("    headers = headers,");
	lines.push("    binary = options.binary,");
	lines.push("    method = options.method,");
	lines.push("    redirect = options.redirect,");
	lines.push("    timeout = options.timeout");
	lines.push("  }");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:_isArray(value)`);
	lines.push("  if type(value) ~= \"table\" then return false end");
	lines.push("  local count = 0");
	lines.push("  for key, _ in pairs(value) do");
	lines.push("    if type(key) ~= \"number\" then");
	lines.push("      return false");
	lines.push("    end");
	lines.push("    count = count + 1");
	lines.push("  end");
	lines.push("  return count == #value");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:_encodeURIComponent(value)`);
	lines.push("  local text = tostring(value)");
	lines.push("  return (text:gsub(\"([^%w%-%_%.%~])\", function(char)");
	lines.push("    return string.format(\"%%%02X\", string.byte(char))");
	lines.push("  end))");
	lines.push("end");
	lines.push("");
	lines.push(`function ${clientName}:_buildQueryString(query)`);
	lines.push("  if type(query) ~= \"table\" then return \"\" end");
	lines.push("  local parts = {}");
	lines.push("  local keys = {}");
	lines.push("  for key, _ in pairs(query) do");
	lines.push("    if key ~= nil then");
	lines.push("      table.insert(keys, tostring(key))");
	lines.push("    end");
	lines.push("  end");
	lines.push("  table.sort(keys)");
	lines.push("");
	lines.push("  for _, key in ipairs(keys) do");
	lines.push("    local value = query[key]");
	lines.push("    if value ~= nil then");
	lines.push("      local encodedKey = self:_encodeURIComponent(key)");
	lines.push("      if self:_isArray(value) then");
	lines.push("        for _, item in ipairs(value) do");
	lines.push("          if item ~= nil then");
	lines.push("            table.insert(parts, encodedKey .. \"=\" .. self:_encodeURIComponent(item))");
	lines.push("          end");
	lines.push("        end");
	lines.push("      else");
	lines.push("        table.insert(parts, encodedKey .. \"=\" .. self:_encodeURIComponent(value))");
	lines.push("      end");
	lines.push("    end");
	lines.push("  end");
	lines.push("");
	lines.push("  return table.concat(parts, \"&\")");
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

function emitNode(lines: string[], parentName: string, node: PathTreeNode, indentLevel: number, rootRef: string) {
	const indent = "  ".repeat(indentLevel);

	for (const [key, value] of Object.entries(node)) {
		if (key === "__methods") continue;
		if (!value || typeof value !== "object") continue;

		const childRef = luaChildRef(parentName, key);
		lines.push(`${indent}${childRef} = {}`);
		emitNode(lines, childRef, value.children as PathTreeNode, indentLevel, rootRef);
	}

	if (node.__methods) {
		emitMethods(lines, parentName, rootRef, node.__methods, indentLevel);
	}
}

function emitMethods(lines: string[], tableName: string, rootRef: string, methods: MethodsMap, indentLevel: number) {
	const indent = "  ".repeat(indentLevel);

	for (let [method, data] of Object.entries(methods)) {
		const { mapping: paramNameMap, ordered: luaParams } = makeUniqueLuaParams(data.pathParams);
		const optionsArgIndex = luaParams.length + 1;

		method = method.replace(/@/g, "");

		lines.push("");
		lines.push(`${indent}${tableName}.${method} = function(...)`);
		lines.push(`${indent}  local __args = { ... }`);
		lines.push(`${indent}  if __args[1] == ${tableName} then`);
		lines.push(`${indent}    table.remove(__args, 1)`);
		lines.push(`${indent}  end`);
		for (let i = 0; i < luaParams.length; i++) {
			lines.push(`${indent}  local ${luaParams[i]} = __args[${i + 1}]`);
		}
		lines.push(`${indent}  local options = __args[${optionsArgIndex}]`);
		lines.push(`${indent}  options = options or {}`);
		lines.push(`${indent}  return ${rootRef}:_request {`);
		lines.push(`${indent}    url = "${buildLuaPath(data.fullPath, paramNameMap)}",`);
		lines.push(`${indent}    method = "${method.toUpperCase()}",`);
		lines.push(`${indent}    body = options.body,`);
		lines.push(`${indent}    query = options.query,`);
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
