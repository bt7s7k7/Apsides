import { EventEmitter } from "../../events/EventEmitter"
import { EventListener } from "../../events/EventListener"
import { ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ClientRequest } from "./ClientRequest"

export abstract class MessageTransport extends EventListener {
    public readonly onNotification = new EventEmitter<object>()
    public readonly onRequest = new EventEmitter<ClientRequest>()
    public readonly onClose = new EventEmitter<void>()

    public abstract sendNotification(notification: object): Promise<void>
    public abstract sendRequest(request: object): Promise<object>

    public static readonly kind = new ServiceKind<MessageTransport>("MessageTransport")
}
