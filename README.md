# openapi-2-lua

A CLI tool that generates a Lua client library from an OpenAPI spec.

## Warning

Most of this project was vibe coded. Please review the output and use at your own risk.

## What is it?

Given an OpenAPI (v3) JSON file, this tool generates a Lua module with a nested table structure that mirrors your API paths, and convenience methods for each operation.

## Why does this exist?

I couldn’t find a working generator that fit my needs, and I only needed this for a specific use case.
If a better tool comes around, I’ll likely just archive this one.

## Requirements

- Node.js
- npm

## Install / Run

### Run with npx (recommended)

```sh
npx openapi-2-lua --spec openapi.json --out client.lua --name Client
```

### Install globally

```sh
npm i -g openapi-2-lua
openapi-2-lua --spec openapi.json --out client.lua --name Client
```

## Usage

```sh
npx openapi-2-lua@latests --spec openapi.json --out client.lua --name Client
```

### Options

- `-s, --spec <file>`: Path to the OpenAPI spec file (default: `openapi.json`)
- `-o, --out <file>`: Output Lua file path (default: `client.lua`)
- `-n, --name <clientName>`: Lua client table name (default: `Client`)

## Generated client expectations

The generated client expects you to provide a `request` function on construction that accepts a single table argument in this shape:

```lua
-- request { url = string, body? = string, headers? = { [string] = string }, binary? = boolean,
--           method? = string, redirect? = boolean, timeout? = number }
```

The generated client calls it like:

```lua
return self.request(request_options)
```

### Parameters

1. `request_options`: { url = self.baseUrl .. options.url, body = options.body, headers = options.headers, binary = options.binary, method = options.method, redirect = options.redirect, timeout = options.timeout}

## Using the generated client

```lua
local Client = require("client")

local client = Client:new({
	baseUrl = "https://api.example.com",
	request = function(opts)
		-- implement your HTTP call here
		-- opts.url, opts.method, opts.headers, opts.body, ...
	end
})

-- Example endpoint call (depends on your spec)
-- client.users["@me"].get()
```

## Notes

- Path segments that aren’t valid Lua identifiers (e.g. `@me`) are emitted using bracket access (e.g. `users["@me"]`).
- Path parameters become function arguments (e.g. `/users/{target}/flags` -> `get(target, options)`).

## Publishing (maintainers)

This repo includes a GitHub Actions workflow that publishes to npm when you push a version tag like `v1.2.3`.

- Required repo secret: `NPM_TOKEN`
- Workflow: `.github/workflows/publish-npm.yml`
