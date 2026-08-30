import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 renamed the `middleware` file convention to `proxy`. next-intl's
// factory is unchanged; only the file name and export site moved.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, the admin surface (Plan B), Next internals, and any path
  // that looks like a file. Everything else gets locale negotiation.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
