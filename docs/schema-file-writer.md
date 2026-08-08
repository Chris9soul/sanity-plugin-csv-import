# Schema File Writer

The Studio tool runs in the browser and cannot write into the consumer's
repository directly. To enable **Write to project**, provide a host-owned
`schemaFileWriter` that posts to a local development endpoint.

## Configure

```ts
import {
  csvImportPlugin,
  type SchemaFileWriter,
} from "sanity-plugin-csv-import";

const schemaFileWriter: SchemaFileWriter = {
  isAvailable: async () => {
    const response = await fetch("/api/csv-import/schema-file");
    if (!response.ok) return false;
    return ((await response.json()) as { enabled?: boolean }).enabled === true;
  },
  write: async (schema) => {
    const response = await fetch("/api/csv-import/schema-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(schema),
    });
    if (!response.ok) {
      throw new Error(
        ((await response.json()) as { message?: string }).message ??
          "Schema write failed",
      );
    }
    return response.json();
  },
};

export default defineConfig({
  // ...
  plugins: [csvImportPlugin({ schemaFileWriter })],
});
```

`isAvailable` is optional. Omit it to always show the button, or return `false`
outside development. `write` receives `GeneratedSchema` (`fileName`,
`importPath`, `exportName`, `typeName`, `code`) and may return
`{filePath, message}` for the success toast.

## Endpoint

Put the write logic in one shared module, then glue it to your framework:

```ts
// src/lib/schemaWriter.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const documentsDir = path.join(
  process.cwd(),
  "src/lib/sanity/schemaTypes/documents",
);
const schemaFile = path.join(process.cwd(), "src/lib/sanity/schema.ts");

export async function writeSchema(body: unknown) {
  const { fileName, code, exportName, importPath } = body as {
    fileName?: unknown;
    code?: unknown;
    exportName?: unknown;
    importPath?: unknown;
  };
  if (
    typeof fileName !== "string" ||
    !/^[A-Za-z][A-Za-z0-9]*\.ts$/.test(fileName) ||
    typeof code !== "string"
  ) {
    return { status: 400, body: { message: "Invalid schema payload" } };
  }

  await mkdir(documentsDir, { recursive: true });
  await writeFile(path.join(documentsDir, fileName), code, "utf8");

  if (typeof exportName === "string" && typeof importPath === "string") {
    await registerSchemaType(exportName, importPath);
  }

  return {
    status: 200,
    body: { filePath: fileName, message: "Schema written and registered" },
  };
}

async function registerSchemaType(exportName: string, importPath: string) {
  const source = await readFile(schemaFile, "utf8");
  if (
    new RegExp(`import\\s*{[^}]*\\b${exportName}\\b[^}]*}.*from`).test(source)
  )
    return;

  const lines = source.split("\n");
  const lastImport = lines.reduce(
    (last, line, i) => (/^import\s/.test(line) ? i : last),
    -1,
  );
  const typesIndex = lines.findIndex((line) => /types:\s*\[/.test(line));
  if (lastImport === -1 || typesIndex === -1) return;

  lines.splice(
    lastImport + 1,
    0,
    `import { ${exportName} } from '${importPath}'`,
  );
  lines.splice(typesIndex + 1, 0, `\t\t${exportName},`);
  await writeFile(schemaFile, lines.join("\n"), "utf8");
}
```

`writeSchema` expects this project structure:

- `schemaTypes/documents/`: generated `{name}Type.ts` files live here.
- `schema.ts`: the schema registry: `import { ... } from '...'` statements
  followed by a `types: [ ... ]` array.

Adjust `documentsDir` and `schemaFile` if your project differs. If you don't
keep a registry file, drop the `registerSchemaType` call.

### Astro: `src/pages/api/csv-import/schema-file.ts`

```ts
import type { APIRoute } from "astro";
import { writeSchema } from "../lib/schemaWriter";

export const prerender = false;
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ enabled: import.meta.env.DEV }), {
    headers: { "content-type": "application/json" },
  });
export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ message: "Development only" }), {
      status: 403,
    });
  }
  const { status, body } = await writeSchema(await request.json());
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};
```

Static Astro sites need an adapter and on-demand rendering for this route; it
is meant for `astro dev`.

### Next.js: `app/api/csv-import/schema-file/route.ts`

```ts
import { NextResponse } from "next/server";
import { writeSchema } from "@/lib/schemaWriter";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Development only" }, { status: 403 });
  }
  const { status, body } = await writeSchema(await request.json());
  return NextResponse.json(body, { status });
}
```

### SvelteKit: `src/routes/api/csv-import/schema-file/+server.ts`

```ts
import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { writeSchema } from "$lib/schemaWriter";

export const GET = () => json({ enabled: dev });
export const POST = async ({ request }) => {
  if (!dev) return json({ message: "Development only" }, { status: 403 });
  const { status, body } = await writeSchema(await request.json());
  return json(body, { status });
};
```

## Keep it safe

- Dev-only and behind the same Studio authorization as other local routes.
- Accept only generated `.ts` filenames; write beneath one fixed directory.
- No arbitrary paths, listings, or delete operations.
- Copy/download stays the fallback when no writer is configured.
- Use a narrow CORS/credentials policy if the Studio and endpoint differ in origin.

Astro references:

- https://docs.astro.build/en/guides/endpoints/
- https://docs.astro.build/en/guides/on-demand-rendering/
