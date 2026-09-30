import Module from 'node:module';
import { pathToFileURL } from 'node:url';

Module.register(pathToFileURL(process.env.COPILOT_RESOLVER).href, import.meta.url);
await import(pathToFileURL(process.env.EXTENSION_PATH).href);
