const dotenv = require('dotenv');

// Load environment variables from .env file if it exists
dotenv.config();

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  maxJsonBodySize: process.env.MAX_JSON_BODY_SIZE || '10mb',
  logLevel: process.env.LOG_LEVEL || 'info',
  // F2: real photo storage. SUPABASE_SECRET_KEY is what Supabase's current
  // dashboard calls a "secret" key (sb_secret_...) -- functionally the same
  // full-access, backend-only key that used to be called "service_role".
  // Never expose this to any frontend.
  supabase: {
    url: process.env.SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  },
};
