import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two pages:
//   index.html -> "/"       homepage (static, holds the GoHighLevel chat widget, no forms)
//   quote.html -> "/quote"  the React landing page with the 8-question form (no chat widget)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        quote: "quote.html",
      },
    },
  },
});
