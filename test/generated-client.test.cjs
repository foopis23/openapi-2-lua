const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const { lua, lauxlib, lualib, to_luastring } = require("fengari");
const interop = require("fengari-interop");

function luaGet(obj, key) {
	if (obj && typeof obj.get === "function") return obj.get(key);
	return obj ? obj[key] : undefined;
}

function luaGetNested(obj, ...keys) {
	let current = obj;
	for (const key of keys) {
		current = luaGet(current, key);
	}
	return current;
}

function generateClientLua({ specPath, outPath, clientName = "Client" }) {
	const cliPath = path.resolve(__dirname, "..", "dist", "openapi-2-lua.cjs");
	execFileSync(process.execPath, [cliPath, "--spec", specPath, "--out", outPath, "--name", clientName], {
		stdio: "pipe",
		cwd: path.resolve(__dirname, "..")
	});
}

function runLua(luaCode, luaSnippet) {
	const L = lauxlib.luaL_newstate();
	lualib.luaL_openlibs(L);

	// Enable JS<->Lua interop (adds `js` lib and helpers)
	interop.luaopen_js(L);
	lua.lua_setglobal(L, to_luastring("js"));

	// 1) Load the generated module chunk (it ends with `return Client`).
	let status = lauxlib.luaL_dostring(L, to_luastring(luaCode));
	if (status !== lua.LUA_OK) {
		const message = lua.lua_tojsstring(L, -1);
		throw new Error(message);
	}

	// The module return value is on the stack; store it as a global `Client`.
	lua.lua_setglobal(L, to_luastring("Client"));

	// 2) Run the test snippet as a separate chunk.
	status = lauxlib.luaL_dostring(L, to_luastring(luaSnippet));
	if (status !== lua.LUA_OK) {
		const message = lua.lua_tojsstring(L, -1);
		throw new Error(message);
	}

	lua.lua_getglobal(L, to_luastring("captured"));
	return interop.tojs(L, -1);
}

test("generated client handles path params with '.' call", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-2-lua-"));
	const specPath = path.resolve(__dirname, "fixtures", "openapi.json");
	const outPath = path.join(tmpDir, "client.lua");

	generateClientLua({ specPath, outPath });
	const luaCode = fs.readFileSync(outPath, "utf8");

	const captured = runLua(
		luaCode,
		`
captured = nil

local client = Client:new({
  baseUrl = "https://example.test",
  baseHeaders = { ["X-Base"] = "base", ["X-Override"] = "base" },
  request = function(opts)
    captured = opts
    return opts
  end
})

client.users.flags.get("123", {
  headers = { ["X-Override"] = "opt", ["X-Opt"] = "opt" }
})
`
	);

	assert.equal(luaGet(captured, "method"), "GET");
	assert.equal(luaGet(captured, "url"), "https://example.test/users/123/flags");
	assert.equal(luaGetNested(captured, "headers", "X-Base"), "base");
	assert.equal(luaGetNested(captured, "headers", "X-Override"), "opt");
	assert.equal(luaGetNested(captured, "headers", "X-Opt"), "opt");
});

test("generated client handles path params with ':' call", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-2-lua-"));
	const specPath = path.resolve(__dirname, "fixtures", "openapi.json");
	const outPath = path.join(tmpDir, "client.lua");

	generateClientLua({ specPath, outPath });
	const luaCode = fs.readFileSync(outPath, "utf8");

	const captured = runLua(
		luaCode,
		`
captured = nil

local client = Client:new({
  baseUrl = "https://example.test",
  request = function(opts)
    captured = opts
    return opts
  end
})

client.users.flags:get("456")
`
	);

	assert.equal(luaGet(captured, "method"), "GET");
	assert.equal(luaGet(captured, "url"), "https://example.test/users/456/flags");
});

test("generated client forwards body and headers", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-2-lua-"));
	const specPath = path.resolve(__dirname, "fixtures", "openapi.json");
	const outPath = path.join(tmpDir, "client.lua");

	generateClientLua({ specPath, outPath });
	const luaCode = fs.readFileSync(outPath, "utf8");

	const captured = runLua(
		luaCode,
		`
captured = nil

local client = Client:new({
  baseUrl = "https://example.test",
  request = function(opts)
    captured = opts
    return opts
  end
})

client.echo.post({
  body = "hello",
  headers = { ["Content-Type"] = "text/plain" }
})
`
	);

	assert.equal(luaGet(captured, "method"), "POST");
	assert.equal(luaGet(captured, "url"), "https://example.test/echo");
	assert.equal(luaGet(captured, "body"), "hello");
	assert.equal(luaGetNested(captured, "headers", "Content-Type"), "text/plain");
});
