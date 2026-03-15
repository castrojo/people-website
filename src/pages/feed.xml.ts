// Expose the Go-generated RSS feed as a static page endpoint.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export async function GET() {
  const feedPath = join(dirname(fileURLToPath(import.meta.url)), '../../src/data/feed.xml');
  let xml = '';
  try {
    xml = readFileSync(feedPath, 'utf-8');
  } catch {
    xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>CNCF People</title></channel></rss>';
  }
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
