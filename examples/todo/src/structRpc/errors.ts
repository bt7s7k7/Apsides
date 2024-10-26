export class ApiConsistencyError extends Error {
    override name = "ApiConsistencyError"
}

export const ERR_INVALID_BINDING_ID = "ERR_INVALID_BINDING_ID"
export const ERR_CONTROLLER_NOT_FOUND = "ERR_CONTROLLER_NOT_FOUND"
export const ERR_INVALID_ACTION = "ERR_INVALID_ACTION"
export const ERR_CANNOT_BIND_RESULT = "ERR_CANNOT_BIND_RESULT"
