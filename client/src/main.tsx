import { createRoot } from "react-dom/client";
import posthog from "posthog-js";

import App from "./App";
import "./index.css";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// Default to the reverse-proxy path so ad blockers / DNS filters / CSPs can't
// drop the SDK. Vercel rewrites /_ph/* → us.i.posthog.com. For local dev
// (npm run dev) set VITE_POSTHOG_HOST=https://us.i.posthog.com in .env.local.
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "/_ph";

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
  });
}

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
