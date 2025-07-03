import Docker from 'dockerode';
import { logger } from '../utils/logger';

const docker = new Docker();

export class DockerService {
    /**
     * Create a new media server container for a customer
     */
    async createMediaServerContainer(config: {
        userId: string;
        containerName: string;
        mediaServerType: 'JELLYFIN' | 'PLEX' | 'EMBY';
        subdomainSlug: string;
        storageMount: string;
        cpuLimit: number;
        memoryLimit: number;
    }) {
        try {
            logger.info(`Creating container for user ${config.userId}:`, config);

            // Get the appropriate Docker image based on media server type
            const imageMap = {
                JELLYFIN: 'jellyfin/jellyfin:latest',
                PLEX: 'plexinc/pms-docker:latest',
                EMBY: 'emby/embyserver:latest'
            };

            const image = imageMap[config.mediaServerType];
            if (!image) {
                throw new Error(`Unsupported media server type: ${config.mediaServerType}`);
            }

            // Pull the image if it doesn't exist
            await this.pullImageIfNeeded(image);

            // Create container configuration
            const containerConfig = {
                Image: image,
                name: config.containerName,
                Env: this.getEnvironmentVariables(config),
                ExposedPorts: { '8096/tcp': {} },
                HostConfig: {
                    PortBindings: { '8096/tcp': [{ HostPort: '0' }] }, // Auto-assign port
                    Binds: [
                        `${config.storageMount}:/media`,
                        `${config.containerName}-config:/config`
                    ],
                    Memory: config.memoryLimit * 1024 * 1024, // Convert MB to bytes
                    CpuShares: Math.floor(config.cpuLimit * 1024), // Convert to CPU shares
                    RestartPolicy: { Name: 'unless-stopped' },
                    NetworkMode: 'media-platform_media-platform'
                },
                Labels: {
                    'media-platform.user': config.userId,
                    'media-platform.type': config.mediaServerType.toLowerCase(),
                    'media-platform.subdomain': config.subdomainSlug
                }
            };

            // Create the container
            const container = await docker.createContainer(containerConfig);
            
            // Start the container
            await container.start();

            // Get container info
            const containerInfo = await container.inspect();

            logger.info(`Container created successfully: ${containerInfo.Id}`);

            return {
                dockerContainerId: containerInfo.Id,
                externalPort: containerInfo.NetworkSettings.Ports['8096/tcp']?.[0]?.HostPort,
                status: 'RUNNING'
            };

        } catch (error) {
            logger.error('Failed to create media server container:', error);
            throw error;
        }
    }

    /**
     * Stop a container
     */
    async stopContainer(containerName: string) {
        try {
            const container = docker.getContainer(containerName);
            await container.stop();
            logger.info(`Container stopped: ${containerName}`);
        } catch (error) {
            logger.error(`Failed to stop container ${containerName}:`, error);
            throw error;
        }
    }

    /**
     * Start a container
     */
    async startContainer(containerName: string) {
        try {
            const container = docker.getContainer(containerName);
            await container.start();
            logger.info(`Container started: ${containerName}`);
        } catch (error) {
            logger.error(`Failed to start container ${containerName}:`, error);
            throw error;
        }
    }

    /**
     * Remove a container
     */
    async removeContainer(containerName: string) {
        try {
            const container = docker.getContainer(containerName);
            
            // Stop the container first if it's running
            try {
                await container.stop();
            } catch (stopError) {
                // Container might already be stopped
                logger.warn(`Container ${containerName} was already stopped`);
            }

            // Remove the container
            await container.remove({ force: true });
            logger.info(`Container removed: ${containerName}`);
        } catch (error) {
            logger.error(`Failed to remove container ${containerName}:`, error);
            throw error;
        }
    }

    /**
     * Get container status
     */
    async getContainerStatus(containerName: string) {
        try {
            const container = docker.getContainer(containerName);
            const info = await container.inspect();
            
            return {
                id: info.Id,
                status: info.State.Status,
                running: info.State.Running,
                ports: info.NetworkSettings.Ports,
                created: info.Created,
                startedAt: info.State.StartedAt
            };
        } catch (error) {
            logger.error(`Failed to get container status ${containerName}:`, error);
            return null;
        }
    }

    /**
     * Get container logs
     */
    async getContainerLogs(containerName: string, tail: number = 100) {
        try {
            const container = docker.getContainer(containerName);
            const logs = await container.logs({
                stdout: true,
                stderr: true,
                tail: tail,
                timestamps: true
            });
            
            return logs.toString();
        } catch (error) {
            logger.error(`Failed to get container logs ${containerName}:`, error);
            throw error;
        }
    }

    /**
     * Pull Docker image if it doesn't exist locally
     */
    private async pullImageIfNeeded(imageName: string) {
        try {
            // Check if image exists locally
            const images = await docker.listImages();
            const imageExists = images.some(img => 
                img.RepoTags && img.RepoTags.includes(imageName)
            );

            if (!imageExists) {
                logger.info(`Pulling Docker image: ${imageName}`);
                await new Promise((resolve, reject) => {
                    docker.pull(imageName, (err, stream) => {
                        if (err) return reject(err);
                        
                        docker.modem.followProgress(stream, (err, res) => {
                            if (err) return reject(err);
                            resolve(res);
                        });
                    });
                });
                logger.info(`Image pulled successfully: ${imageName}`);
            }
        } catch (error) {
            logger.error(`Failed to pull image ${imageName}:`, error);
            throw error;
        }
    }

    /**
     * Get environment variables for different media server types
     */
    private getEnvironmentVariables(config: any) {
        const commonEnv = [
            'TZ=UTC',
            'PUID=1000',
            'PGID=1000'
        ];

        switch (config.mediaServerType) {
            case 'JELLYFIN':
                return [
                    ...commonEnv,
                    'JELLYFIN_PublishedServerUrl=https://' + config.subdomainSlug + '.' + process.env.DOMAIN
                ];
            case 'PLEX':
                return [
                    ...commonEnv,
                    'PLEX_CLAIM=',
                    'ADVERTISE_IP=https://' + config.subdomainSlug + '.' + process.env.DOMAIN + ':443'
                ];
            case 'EMBY':
                return [
                    ...commonEnv
                ];
            default:
                return commonEnv;
        }
    }

    /**
     * List all media platform containers
     */
    async listMediaPlatformContainers() {
        try {
            const containers = await docker.listContainers({ all: true });
            
            return containers.filter(container => 
                container.Labels && container.Labels['media-platform.user']
            ).map(container => ({
                id: container.Id,
                name: container.Names[0]?.replace('/', ''),
                image: container.Image,
                status: container.Status,
                state: container.State,
                userId: container.Labels['media-platform.user'],
                mediaType: container.Labels['media-platform.type'],
                subdomain: container.Labels['media-platform.subdomain'],
                ports: container.Ports
            }));
        } catch (error) {
            logger.error('Failed to list media platform containers:', error);
            throw error;
        }
    }
}

export const dockerService = new DockerService();