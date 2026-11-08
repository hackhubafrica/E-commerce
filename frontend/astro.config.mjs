import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro"));
const astroCookie = astroRequire.resolve("cookie");

export default defineConfig({
  integrations: [react()],
  vite: {
    resolve: {
      alias: [{ find: /^cookie$/, replacement: astroCookie }],
    },
    ssr: {
      noExternal: ["cookie"],
    },
  },
});
