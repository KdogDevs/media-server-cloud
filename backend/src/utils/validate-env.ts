import Joi from 'joi';

const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    
    // Database
    DATABASE_URL: Joi.string().required(),
    
    // Redis
    REDIS_URL: Joi.string().default('redis://localhost:6379'),
    
    // Clerk Authentication
    CLERK_PUBLISHABLE_KEY: Joi.string().required(),
    CLERK_SECRET_KEY: Joi.string().required(),
    CLERK_WEBHOOK_SECRET: Joi.string().required(),
    
    // Stripe
    STRIPE_SECRET_KEY: Joi.string().required(),
    STRIPE_WEBHOOK_SECRET: Joi.string().required(),
    STRIPE_PRICE_ID: Joi.string().required(),
    
    // Hetzner
    HETZNER_TOKEN: Joi.string().required(),
    HETZNER_STORAGE_BOX_HOST: Joi.string().required(),
    HETZNER_STORAGE_BOX_USER: Joi.string().required(),
    HETZNER_STORAGE_BOX_PASS: Joi.string().required(),
    
    // Security
    JWT_SECRET: Joi.string().min(32).required(),
    SESSION_SECRET: Joi.string().min(32).required(),
    
    // Domain
    DOMAIN: Joi.string().required(),
    FRONTEND_URL: Joi.string().uri().required(),
    BACKEND_URL: Joi.string().uri().required(),
    
    // Optional
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    ADMIN_EMAIL: Joi.string().email(),
}).unknown();

export const validateEnv = () => {
    const { error, value } = envSchema.validate(process.env);
    
    if (error) {
        throw new Error(`Environment validation error: ${error.message}`);
    }
    
    // Replace process.env with validated values
    Object.assign(process.env, value);
    
    return value;
};