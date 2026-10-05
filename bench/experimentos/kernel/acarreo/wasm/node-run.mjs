// Runs mide.mjs in Node: node node-run.mjs OUT.json
import { readFile, writeFile } from "node:fs/promises";
import { mide } from "./mide.mjs";

const res = await mide(await readFile(new URL("mpn-div.wasm", import.meta.url)), (s) => console.error(s));
await writeFile(process.argv[2] || "mpn-div-node.json", JSON.stringify({ nav: "node", ...res }, null, 1));
