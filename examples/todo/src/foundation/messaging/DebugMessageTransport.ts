import { ClientRequest } from "./ClientRequest"
import { MessageTransport } from "./MessageTransport"

export class DebugMessageTransport extends MessageTransport {
    protected _peer: DebugMessageTransport | null = null

    protected _nextRequestId = 0

    public override sendNotification(notification: object): Promise<void> {
        this._peer?.onNotification.emit(notification)

        return Promise.resolve()
    }

    public override sendRequest(data: object): Promise<object> {
        const request = new ClientRequest(this._nextRequestId++, data)

        this._peer?.onRequest.emit(request)

        return request.asPromise()
    }

    public override[Symbol.dispose]() {
        if (this._peer) {
            this._peer.onClose.emit()
            this._peer._peer = null
            this._peer = null
        }
    }

    protected constructor() { super() }

    public static makePair() {
        const a = new DebugMessageTransport()
        const b = new DebugMessageTransport()

        a._peer = b
        b._peer = a

        return [a, b] as [MessageTransport, MessageTransport]
    }
}
