import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "YouTube Summarizer",
  version: "0.0.1",
  description:
    "Summarize the current YouTube video into a clickable, language-matched outline.",
  permissions: ["sidePanel", "tabs", "storage"],
  host_permissions: ["https://*.youtube.com/*", "https://api.anthropic.com/*"],
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  action: {
    default_title: "Summarize this video",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  options_ui: {
    page: "src/settings/index.html",
    open_in_tab: true,
  },
  content_scripts: [
    {
      // MAIN world: can read the page's window.ytInitialPlayerResponse.
      matches: ["*://www.youtube.com/watch*"],
      js: ["src/content/main-world.ts"],
      run_at: "document_start",
      world: "MAIN",
    },
    {
      // ISOLATED world: bridges page <-> extension, handles seek.
      matches: ["*://www.youtube.com/watch*"],
      js: ["src/content/isolated.ts"],
      run_at: "document_idle",
    },
  ],
});
