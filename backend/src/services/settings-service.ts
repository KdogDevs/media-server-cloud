import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

class SettingsService {
    private prisma: PrismaClient;
    private cache: Map<string, string> = new Map();
    private cacheExpiry: Map<string, number> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Get a system setting value
     */
    async getSetting(key: string, defaultValue: string = ''): Promise<string> {
        try {
            // Check cache first
            const cached = this.cache.get(key);
            const expiry = this.cacheExpiry.get(key);
            
            if (cached && expiry && expiry > Date.now()) {
                return cached;
            }

            // Fetch from database
            const setting = await this.prisma.systemSettings.findUnique({
                where: { key }
            });

            const value = setting?.value || defaultValue;
            
            // Cache the result
            this.cache.set(key, value);
            this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
            
            return value;
        } catch (error) {
            logger.error(`Failed to get setting ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Set a system setting value
     */
    async setSetting(key: string, value: string, description?: string): Promise<void> {
        try {
            await this.prisma.systemSettings.upsert({
                where: { key },
                update: { value, description },
                create: { key, value, description }
            });

            // Update cache
            this.cache.set(key, value);
            this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
            
            logger.info(`Setting ${key} updated successfully`);
        } catch (error) {
            logger.error(`Failed to set setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get multiple settings by prefix
     */
    async getSettingsByPrefix(prefix: string): Promise<Record<string, string>> {
        try {
            const settings = await this.prisma.systemSettings.findMany({
                where: {
                    key: {
                        startsWith: prefix
                    }
                }
            });

            const result: Record<string, string> = {};
            settings.forEach(setting => {
                result[setting.key] = setting.value;
                // Cache each setting
                this.cache.set(setting.key, setting.value);
                this.cacheExpiry.set(setting.key, Date.now() + this.CACHE_TTL);
            });

            return result;
        } catch (error) {
            logger.error(`Failed to get settings with prefix ${prefix}:`, error);
            return {};
        }
    }

    /**
     * Clear cache for a specific key or all keys
     */
    clearCache(key?: string): void {
        if (key) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
        } else {
            this.cache.clear();
            this.cacheExpiry.clear();
        }
    }

    /**
     * Get Hetzner configuration
     */
    async getHetznerConfig(): Promise<{
        token: string;
        storageBoxHost: string;
        storageBoxUser: string;
        storageBoxPass: string;
    }> {
        return {
            token: await this.getSetting('hetzner_token'),
            storageBoxHost: await this.getSetting('hetzner_storage_box_host'),
            storageBoxUser: await this.getSetting('hetzner_storage_box_user'),
            storageBoxPass: await this.getSetting('hetzner_storage_box_pass')
        };
    }

    /**
     * Get platform configuration
     */
    async getPlatformConfig(): Promise<{
        name: string;
        adminEmail: string;
        defaultStorageQuota: number;
        maxContainersPerUser: number;
    }> {
        return {
            name: await this.getSetting('platform_name', 'Media Platform'),
            adminEmail: await this.getSetting('admin_email'),
            defaultStorageQuota: parseInt(await this.getSetting('default_storage_quota', '2048')),
            maxContainersPerUser: parseInt(await this.getSetting('max_containers_per_user', '1'))
        };
    }
}

export const settingsService = new SettingsService();