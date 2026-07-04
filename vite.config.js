import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT : "base" doit correspondre au NOM de ton dépôt GitHub.
// Ex. si l'URL est https://mon-pseudo.github.io/chez-nous/  ->  base: "/chez-nous/"
// Si un jour tu utilises un domaine perso ou un dépôt <pseudo>.github.io, mets base: "/".
export default defineConfig({
  base: "/bientot-chez-nous/",
  plugins: [react()],
});
