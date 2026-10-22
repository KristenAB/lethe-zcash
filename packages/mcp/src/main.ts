#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, openCallLog } from './tools.js';

try {
  openCallLog();
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
await createServer().connect(new StdioServerTransport());
