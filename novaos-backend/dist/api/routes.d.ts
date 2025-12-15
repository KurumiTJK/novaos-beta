import { Router, Request, Response, NextFunction } from 'express';
import { UserPermissions } from '../helpers/action-validator.js';
import { ExecutionPipeline } from '../pipeline/execution-pipeline.js';
export interface RoutesConfig {
    pipeline: ExecutionPipeline;
    getUser?: (req: Request) => {
        id: string;
        permissions: UserPermissions;
    } | null;
}
export declare function createRoutes(config: RoutesConfig): Router;
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=routes.d.ts.map