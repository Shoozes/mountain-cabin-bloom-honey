import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Grout Shader";

// Vite `base` ("/" in dev and the Vercel build, the repo subpath on GitHub
// Pages). Every public/ asset link is prefixed with it so nothing 404s there.
const BASE = import.meta.env.BASE_URL;
// The per-app web manifest is a dynamic response (dev/preview middleware and
// the Nitro deploy); a static subpath host like Pages has no such route.
const SERVES_GROK_MANIFEST = BASE === "/";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Seamless shader textures for Grout. Reviewed cookbook presets plus a large approved mill catalog, exported as reusable tiles.",
      },
      { name: "theme-color", content: "#11100e" },
    ],
    links: [
      { rel: "icon", href: `${BASE}favicon.ico`, sizes: "32x32" },
      { rel: "icon", type: "image/svg+xml", href: `${BASE}favicon.svg` },
      { rel: "stylesheet", href: appCss },
      ...(SERVES_GROK_MANIFEST ? [{ rel: "manifest", href: "/__grok/manifest.webmanifest" }] : []),
      { rel: "apple-touch-icon", href: `${BASE}__grok/icon-180.png` },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
