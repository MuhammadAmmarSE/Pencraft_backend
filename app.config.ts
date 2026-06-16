export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,
    url: process.env.APP_URL || 'http://localhost:3001',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'shopify_ai_copywriter',
  },
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || [
      'read_products',
      'write_products',
    ],
    hostName: process.env.SHOPIFY_HOST_NAME,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 30,
  },
  plans: {
    free: parseInt(process.env.FREE_PLAN_REWRITES, 10) || 5,
    starter: parseInt(process.env.STARTER_PLAN_REWRITES, 10) || 100,
    growth: parseInt(process.env.GROWTH_PLAN_REWRITES, 10) || 500,
    pro: parseInt(process.env.PRO_PLAN_REWRITES, 10) || 99999,
  },
});
