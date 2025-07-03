import axios from 'axios';
import { Client } from 'ssh2';
import { logger } from '../utils/logger';

export class HetznerService {
    private apiToken: string;
    private storageBoxHost: string;
    private storageBoxUser: string;
    private storageBoxPass: string;

    constructor() {
        this.apiToken = process.env.HETZNER_TOKEN!;
        this.storageBoxHost = process.env.HETZNER_STORAGE_BOX_HOST!;
        this.storageBoxUser = process.env.HETZNER_STORAGE_BOX_USER!;
        this.storageBoxPass = process.env.HETZNER_STORAGE_BOX_PASS!;
    }

    /**
     * Create a storage directory for a customer
     */
    async createCustomerStorage(customerId: string, quotaGB: number = 2048) {
        try {
            logger.info(`Creating storage for customer: ${customerId}`);

            // Create customer directory via SSH
            const customerPath = `/media-storage/${customerId}`;
            await this.executeSSHCommand(`mkdir -p ${customerPath}`);

            // Set quota (if supported by the storage system)
            // Note: This is a placeholder - actual quota setting depends on the storage system
            logger.info(`Storage created for customer ${customerId} at ${customerPath}`);

            return {
                path: customerPath,
                quotaGB: quotaGB,
                host: this.storageBoxHost,
                mountPath: `/mnt/hetzner-storage/${customerId}`
            };

        } catch (error) {
            logger.error(`Failed to create storage for customer ${customerId}:`, error);
            throw error;
        }
    }

    /**
     * Mount storage for a customer container
     */
    async mountCustomerStorage(customerId: string, localMountPath: string) {
        try {
            logger.info(`Mounting storage for customer: ${customerId}`);

            const remotePath = `/media-storage/${customerId}`;
            
            // Create local mount directory
            await this.executeLocalCommand(`mkdir -p ${localMountPath}`);

            // Mount using SSHFS (if available) or NFS
            const mountCommand = `sshfs ${this.storageBoxUser}@${this.storageBoxHost}:${remotePath} ${localMountPath} -o allow_other,default_permissions,reconnect`;
            
            await this.executeLocalCommand(mountCommand);

            logger.info(`Storage mounted successfully for customer ${customerId}`);

            return {
                localPath: localMountPath,
                remotePath: remotePath,
                mounted: true
            };

        } catch (error) {
            logger.error(`Failed to mount storage for customer ${customerId}:`, error);
            throw error;
        }
    }

    /**
     * Get storage usage for a customer
     */
    async getStorageUsage(customerId: string) {
        try {
            const customerPath = `/media-storage/${customerId}`;
            const output = await this.executeSSHCommand(`du -sb ${customerPath}`);
            
            const bytes = parseInt(output.split('\t')[0]);
            const gb = bytes / (1024 * 1024 * 1024);

            logger.info(`Storage usage for customer ${customerId}: ${gb.toFixed(2)} GB`);

            return {
                usedBytes: bytes,
                usedGB: gb,
                path: customerPath
            };

        } catch (error) {
            logger.error(`Failed to get storage usage for customer ${customerId}:`, error);
            return {
                usedBytes: 0,
                usedGB: 0,
                path: `/media-storage/${customerId}`
            };
        }
    }

    /**
     * Delete customer storage
     */
    async deleteCustomerStorage(customerId: string) {
        try {
            logger.info(`Deleting storage for customer: ${customerId}`);

            const customerPath = `/media-storage/${customerId}`;
            
            // Remove the customer directory
            await this.executeSSHCommand(`rm -rf ${customerPath}`);

            logger.info(`Storage deleted for customer ${customerId}`);

            return true;

        } catch (error) {
            logger.error(`Failed to delete storage for customer ${customerId}:`, error);
            throw error;
        }
    }

    /**
     * Create backup of customer storage
     */
    async createStorageBackup(customerId: string, backupName?: string) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backup = backupName || `backup-${customerId}-${timestamp}`;
            
            const sourcePath = `/media-storage/${customerId}`;
            const backupPath = `/backups/${backup}`;

            logger.info(`Creating backup for customer ${customerId}: ${backup}`);

            // Create backup directory
            await this.executeSSHCommand(`mkdir -p /backups`);

            // Create compressed backup
            await this.executeSSHCommand(`tar -czf ${backupPath}.tar.gz -C /media-storage ${customerId}`);

            logger.info(`Backup created: ${backupPath}.tar.gz`);

            return {
                backupName: backup,
                backupPath: `${backupPath}.tar.gz`,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Failed to create backup for customer ${customerId}:`, error);
            throw error;
        }
    }

    /**
     * Execute SSH command on storage box
     */
    private async executeSSHCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            
            conn.on('ready', () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }

                    let output = '';
                    let errorOutput = '';

                    stream.on('close', (code, signal) => {
                        conn.end();
                        if (code === 0) {
                            resolve(output);
                        } else {
                            reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
                        }
                    });

                    stream.on('data', (data) => {
                        output += data.toString();
                    });

                    stream.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                });
            });

            conn.on('error', (err) => {
                reject(err);
            });

            conn.connect({
                host: this.storageBoxHost,
                port: 22,
                username: this.storageBoxUser,
                password: this.storageBoxPass,
            });
        });
    }

    /**
     * Execute local command (for mounting)
     */
    private async executeLocalCommand(command: string): Promise<string> {
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * List all customer storage directories
     */
    async listCustomerStorage() {
        try {
            const output = await this.executeSSHCommand('ls -la /media-storage/');
            const lines = output.split('\n').filter(line => line.trim());
            
            const customers = lines
                .filter(line => line.startsWith('d') && !line.includes(' . ') && !line.includes(' .. '))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        name: parts[parts.length - 1],
                        size: parts[4],
                        modified: parts.slice(5, 8).join(' ')
                    };
                });

            return customers;

        } catch (error) {
            logger.error('Failed to list customer storage:', error);
            throw error;
        }
    }
}

export const hetznerService = new HetznerService();