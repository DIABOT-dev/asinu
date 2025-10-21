#!/usr/bin/env node
const { NEXT_PUBLIC_API_URL, AI_GATEWAY_URL } = process.env;
console.log('NEXT_PUBLIC_API_URL', NEXT_PUBLIC_API_URL || '(not set)');
console.log('AI_GATEWAY_URL', AI_GATEWAY_URL || '(not set)');

const targets = [
  ['NEXT_PUBLIC_API_URL', NEXT_PUBLIC_API_URL],
  ['AI_GATEWAY_URL', AI_GATEWAY_URL],
].filter(([, url]) => typeof url === 'string' && url.length > 0);

if (targets.length === 0) {
  console.warn('No URLs configured to probe.');
  process.exit(0);
}

(async () => {
  for (const [label, url] of targets) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`${label} HEAD ${response.status}`);
    } catch (error) {
      console.error(`${label} HEAD error`, error instanceof Error ? error.message : error);
    }
  }
})();
