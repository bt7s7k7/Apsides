import _debug from "debug"
import { io, ManagerOptions, Socket, SocketOptions } from "socket.io-client"
import { EventEmitter } from "../events/EventEmitter"
import { Logger } from "../foundation/logger/Logger"
import { MessageTransport } from "../foundation/messaging/MessageTransport"
import { ServiceFactory } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { SocketIOTransport, SocketIOTransportEvents } from "./SocketIOTransport"

const debug = _debug("apsides:socket-io")

export class SocketIOClient extends SocketIOTransport {
    public override readonly raw: Socket<SocketIOTransportEvents>

    public readonly onReady = new EventEmitter<void>()
    public readonly onConnected = new EventEmitter<void>()
    public readonly onDisconnected = new EventEmitter<void>()

    protected _hasConnected = false

    constructor(
        public readonly services: ServiceProvider,
        options?: SocketIOClient.Options
    ) {
        super()

        const logger = services.get(Logger.kind)

        this.raw = io(options)
        logger.info`Initializing connection...`

        this.raw.on("connect", () => {
            if (!this._hasConnected) {
                this._hasConnected = true
                logger.info`Connected`
                this.onReady.emit()
            } else {
                if (options?.resetOnReconnect) {
                    location.reload()
                    return
                }

                logger.info`Reconnected`
            }

            this.onConnected.emit()
        })

        this.raw.on("connect_error", (error) => {
            if (!this.raw.active) {
                // eslint-disable-next-line no-console
                console.error(error)
            }
        })

        this.raw.on("disconnect", (reason) => {
            this.onDisconnected.emit()

            if (this.raw.active) {
                logger.info`Disconnected (${reason}), reconnecting...`
            } else {
                logger.info`Disconnected (${reason})`
                this.onClose.emit()
            }
        })

        this.raw.on("notify", (message) => {
            debug("Got notify:    %o", message)
            this.onNotification.emit(message)
        })

        this.raw.on("request", (request, callback) => {
            this._handleRequest(request, callback)
        })
    }

    public static make(options: ConstructorParameters<typeof SocketIOClient>[1]): ServiceFactory<MessageTransport> {
        return {
            kind: this.kind,
            init(services) {
                return new SocketIOClient(services, options)
            },
        }
    }

    public static init(services: ServiceProvider) {
        return new this(services)
    }
}

SocketIOClient satisfies ServiceFactory<MessageTransport>

export namespace SocketIOClient {
    export type Options = Partial<ManagerOptions & SocketOptions> & {
        resetOnReconnect?: boolean
    }
}
