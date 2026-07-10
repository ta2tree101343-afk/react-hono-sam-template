#!/usr/bin/env node
// Verifies that apps/api/src/package.json (Lambda deploy manifest) stays in sync
// with apps/api/package.json (workspace runtime deps).
//
// Rationale: SAM's esbuild builder runs `npm install` in src/, not pnpm at the
// workspace root, so pnpm-lock.yaml is NOT honored for the Lambda bundle.
// This script catches drift early. Run in CI.

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")

const parent = JSON.parse(readFileSync(resolve(root, "apps/api/package.json"), "utf8"))
const lambda = JSON.parse(readFileSync(resolve(root, "apps/api/src/package.json"), "utf8"))

// Deps intentionally NOT shipped in the Lambda bundle.
const excluded = new Set([
	"@aws-sdk/client-dynamodb", // Lambda runtime provides
	"@aws-sdk/lib-dynamodb", // Lambda runtime provides
	"@hono/node-server", // local dev entry only
	"dotenv", // local dev only (.env loader)
	// esbuild is NOT listed in apps/api/src/package.json intentionally — SAM's
	// build sandbox uses a globally-installed esbuild (see .github/workflows/ci.yml
	// and the README section on SAM esbuild builder). Version parity with the
	// workspace-level esbuild is kept manually.
	"esbuild",
])

const parentDeps = parent.dependencies ?? {}
const lambdaDeps = lambda.dependencies ?? {}

const errors = []

for (const [name, version] of Object.entries(parentDeps)) {
	if (excluded.has(name)) continue
	if (!lambdaDeps[name]) {
		errors.push(`Missing in apps/api/src/package.json: ${name}@${version}`)
		continue
	}
	if (lambdaDeps[name] !== version) {
		errors.push(`Version mismatch for ${name}: parent=${version}, lambda=${lambdaDeps[name]}`)
	}
}

for (const [name, version] of Object.entries(lambdaDeps)) {
	if (!parentDeps[name] && !excluded.has(name)) {
		errors.push(
			`Extra in apps/api/src/package.json (not in parent runtime deps): ${name}@${version}`,
		)
	}
}

if (errors.length > 0) {
	console.error("apps/api/src/package.json is out of sync with apps/api/package.json:\n")
	for (const e of errors) console.error("  -", e)
	console.error("\nUpdate apps/api/src/package.json to mirror apps/api/package.json runtime deps.")
	console.error("Excluded from the Lambda bundle:", Array.from(excluded).join(", "))
	process.exit(1)
}

console.log("apps/api/src/package.json is in sync ✓")
