// Run the board without the Copilot app: `node apps/copilot-canvas/dev.mjs [workspace]`.
// Run buttons print the prompt they would send instead of sending it.

import { resolve } from 'node:path';
import { createSpecServer } from './server.mjs';

const root = resolve(process.argv[2] ?? process.cwd());
const board = await createSpecServer({
    root,
    send: async (prompt) => {
        console.log(`[dev] would send: ${prompt}`);
        return false;
    },
    log: console.log,
});

console.log(`SpecKit spec board for ${root}`);
console.log(`Open: ${board.url}`);

process.on('SIGINT', async () => {
    await board.close();
    process.exit(0);
});
