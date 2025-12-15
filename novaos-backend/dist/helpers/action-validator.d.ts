import { z } from 'zod';
import { ActionType, RequestedAction, PipelineState } from './types';
/**
 * Schema for array of actions in API request.
 */
export declare const RequestedActionsSchema: z.ZodArray<z.ZodEffects<z.ZodObject<{
    type: z.ZodEnum<["set_reminder", "create_path", "generate_spark", "search_web", "end_conversation", "override_veto"]>;
    params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    source: z.ZodEnum<["ui_button", "command_parser", "api_field"]>;
}, "strip", z.ZodTypeAny, {
    type: "set_reminder" | "create_path" | "generate_spark" | "search_web" | "end_conversation" | "override_veto";
    params: Record<string, unknown>;
    source: "ui_button" | "command_parser" | "api_field";
}, {
    type: "set_reminder" | "create_path" | "generate_spark" | "search_web" | "end_conversation" | "override_veto";
    params: Record<string, unknown>;
    source: "ui_button" | "command_parser" | "api_field";
}>, {
    type: "set_reminder" | "create_path" | "generate_spark" | "search_web" | "end_conversation" | "override_veto";
    params: Record<string, unknown>;
    source: "ui_button" | "command_parser" | "api_field";
}, {
    type: "set_reminder" | "create_path" | "generate_spark" | "search_web" | "end_conversation" | "override_veto";
    params: Record<string, unknown>;
    source: "ui_button" | "command_parser" | "api_field";
}>, "many">;
export interface ActionValidationResult {
    valid: boolean;
    errors: ActionValidationError[];
    validActions: RequestedAction[];
}
export interface ActionValidationError {
    index: number;
    action?: string;
    reason: string;
    code: 'INVALID_TYPE' | 'INVALID_SOURCE' | 'INVALID_PARAMS' | 'UNAUTHORIZED' | 'INVALID_STATE';
}
/**
 * User permissions for actions.
 * In production, this would come from a database or auth service.
 */
export interface UserPermissions {
    userId: string;
    allowedActions: ActionType[];
    isAdmin: boolean;
}
/**
 * Check if user is authorized for an action.
 */
export declare function isUserAuthorized(actionType: ActionType, permissions: UserPermissions | null): boolean;
/**
 * Check if action is valid given current pipeline state.
 */
export declare function isActionValidInState(actionType: ActionType, state: Partial<PipelineState> | null): boolean;
/**
 * Validate and authorize an array of RequestedActions at API boundary.
 *
 * This should be called BEFORE any pipeline processing.
 * Invalid or unauthorized actions are rejected at this layer.
 *
 * @param rawActions - Actions from API request body
 * @param permissions - User's permissions (null if unauthenticated)
 * @param state - Current pipeline state (null for new requests)
 * @returns Validation result with valid actions or errors
 */
export declare function validateRequestedActions(rawActions: unknown, permissions: UserPermissions | null, state?: Partial<PipelineState> | null): ActionValidationResult;
/**
 * Express middleware for action validation.
 * Rejects requests with invalid actions before reaching pipeline.
 */
export declare function actionValidationMiddleware(getPermissions: (req: any) => UserPermissions | null, getState: (req: any) => Partial<PipelineState> | null): (req: any, res: any, next: any) => any;
//# sourceMappingURL=action-validator.d.ts.map