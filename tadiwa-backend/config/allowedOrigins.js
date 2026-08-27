const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const configuredOrigins = [
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_URL),
];

// Dev-only origins so a production instance only trusts what's configured
// via ALLOWED_ORIGINS/FRONTEND_URL.
const devOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000","http://localhost:3001" ,"http://localhost:5173", "http://localhost:5174"];

const allowedOrigins = [...new Set([...devOrigins, ...configuredOrigins])];

export default allowedOrigins;