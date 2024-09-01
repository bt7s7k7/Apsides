export class ClientError extends Error {
    override name = "ClientError"

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

export class TransportError extends Error {
    override name = "TransportError"
}
