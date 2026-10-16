/// <reference types="vite/client" />

/** The commit this build came from (set by scripts/plots-plugin.ts). `sha` is 'dev' on the dev server. */
declare const __ATV_BUILD__: { sha: string; short: string; message: string; author: string; time: string };
