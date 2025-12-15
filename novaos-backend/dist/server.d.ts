import express from 'express';
interface ServerConfig {
    port: number;
    ackTokenSecret: string;
    enableAuditLogging: boolean;
    enableWebVerification: boolean;
}
declare function loadConfig(): ServerConfig;
export declare function createServer(): Promise<express.Application>;
export { loadConfig };
//# sourceMappingURL=server.d.ts.map