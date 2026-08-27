import allowedOrigins from "./allowedOrigins.js";

// Chrome mints a fresh chrome-extension://<id> per install path — there's no
// single fixed value to add to allowedOrigins.js the way FRONTEND_URL works,
// and it changes if the ZSmart Ticket Copilot extension is reloaded from a
// different folder or profile. Trusting any chrome-extension:// origin is
// safe in dev (same convenience tradeoff as devOrigins in allowedOrigins.js)
// but must never apply in production — pin the real extension's origin via
// ALLOWED_ORIGINS there instead, same as any other production origin.
const isDevChromeExtension = (origin) =>
  process.env.NODE_ENV !== "production" && !!origin && origin.startsWith("chrome-extension://");

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || isDevChromeExtension(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;