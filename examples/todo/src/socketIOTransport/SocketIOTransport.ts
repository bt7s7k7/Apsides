import _debug from "debug"
import { Socket } from "socket.io"
import { toString } from "../comTypes/util"
import { ClientRequest } from "../foundation/messaging/ClientRequest"
import { ClientError, ERR_SERVER_ERROR } from "../foundation/messaging/errors"
import { MessageTransport } from "../foundation/messaging/MessageTransport"

const debug = _debug("apsides:socket-io")

export interface SocketIOTransportEvents {
    notify: (message: object) => void
    request: (message: object, callback: (err: string | null, response: object | string) => void) => void
}

export abstract class SocketIOTransport extends MessageTransport {
    public readonly abstract raw: {
        emit(...args: Parameters<Socket<SocketIOTransportEvents>["emit"]>): void
    }

    public override sendNotification(notification: object): Promise<void> {
        debug("Sent notify:   %o", notification)
        this.raw.emit("notify", notification)
        return Promise.resolve()
    }

    public override sendRequest(request: object): Promise<object> {
        debug("Sent request:  %o", request)
        return new Promise<object>((resolve, reject) => {
            this.raw.emit("request", request, (err, data) => {
                debug("Got response:  %o", data)
                if (err == null) {
                    resolve(data as object)
                } else {
                    reject(new ClientError(toString(data), { code: err }))
                }
            })
        })
    }

    protected _handleRequest(...[request, callback]: Parameters<SocketIOTransportEvents["request"]>) {
        debug("Got request:   %o", request)
        const requestHandle = new ClientRequest(-1, request)
        requestHandle.then(
            result => {
                debug("Sent response: %o", result)
                callback(null, result)
            },
            error => {
                if (error instanceof ClientError) {
                    debug("Sent error:    %o %o", error.code, error.message)
                    callback(error.code, error.message)
                } else {
                    debug("Sent internal server error")
                    callback(ERR_SERVER_ERROR, "Internal server error")
                    throw error
                }
            }
        )
        this.onRequest.emit(requestHandle)
    }
}
