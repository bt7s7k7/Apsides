import { Socket } from "socket.io"
import { toString } from "../comTypes/util"
import { ClientRequest } from "../foundation/messaging/ClientRequest"
import { ClientError, ERR_SERVER_ERROR } from "../foundation/messaging/errors"
import { MessageTransport } from "../foundation/messaging/MessageTransport"

export interface SocketIOTransportEvents {
    notify: (message: object) => void
    request: (message: object, callback: (err: string | null, response: object | string) => void) => void
}

export abstract class SocketIOTransport extends MessageTransport {
    public readonly abstract raw: {
        emit(...args: Parameters<Socket<SocketIOTransportEvents>["emit"]>): void
    }

    public override sendNotification(notification: object): Promise<void> {
        this.raw.emit("notify", notification)
        return Promise.resolve()
    }

    public override sendRequest(request: object): Promise<object> {
        return new Promise<object>((resolve, reject) => {
            this.raw.emit("request", request, (err, data) => {
                if (err == null) {
                    resolve(data as object)
                } else {
                    reject(new ClientError(toString(data), { code: err }))
                }
            })
        })
    }

    protected _handleRequest(...[request, callback]: Parameters<SocketIOTransportEvents["request"]>) {
        const requestHandle = new ClientRequest(-1, request)
        requestHandle.then(
            result => callback(null, result),
            error => {
                if (error instanceof ClientError) {
                    callback(error.code, error.message)
                } else {
                    callback(ERR_SERVER_ERROR, "Internal server error")
                    throw error
                }
            }
        )
        this.onRequest.emit(requestHandle)
    }
}
