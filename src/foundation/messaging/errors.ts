export class ClientError extends Error {
    public override name = "ClientError"

    public readonly code

    constructor(message: string, options?: ErrorOptions & { code?: string }) {
        super(message, options)

        if (options?.code != null) {
            this.code = options?.code
        } else {
            this.code = "ERR_OTHER"
        }
    }
}

export const ERR_SERVER_ERROR = "ERR_SERVER_ERROR"

export class TransportError extends Error {
    public override name = "TransportError"
}
