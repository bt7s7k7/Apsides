import { Server, Socket } from "socket.io"
import { EventEmitter } from "../events/EventEmitter"
import { EventListener } from "../events/EventListener"
import { MessageTransport } from "../foundation/messaging/MessageTransport"
import { UNMANAGED_HTTP_SERVER_SERVICE } from "../foundation/unmanaged"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { SocketIOTransport, SocketIOTransportEvents } from "./SocketIOTransport"

export class SocketIOServer extends EventListener {
    protected readonly _server: Server<SocketIOTransportEvents>

    public readonly onConnected = new EventEmitter<SocketIOServer.SocketIOConnection>()

    constructor(
        public readonly services: ServiceProvider,
    ) {
        super()

        const nativeServer = services.get(UNMANAGED_HTTP_SERVER_SERVICE)
        this._server = new Server(nativeServer)

        this._server.on("connection", (socket) => {
            const connection = new SocketIOServer.SocketIOConnection(this, socket)
            this.onConnected.emit(connection)
        })
    }

    public static make(callback: (connection: SocketIOServer.SocketIOConnection) => void): ServiceFactory<SocketIOServer> {
        return {
            kind: this.kind,
            init(services) {
                const server = new SocketIOServer(services)
                server.onConnected.add(null, callback)
                return server
            },
        }
    }

    public static readonly kind = new ServiceKind<SocketIOServer>("SocketIOServer")
}

export namespace SocketIOServer {
    export class SocketIOConnection extends SocketIOTransport {
        public makeServiceLoader() {
            return this.server.services.makeTransientLoader()
                .provide(MessageTransport.kind, this)
        }

        constructor(
            public readonly server: SocketIOServer,
            public readonly raw: Socket<SocketIOTransportEvents>,
        ) {
            super()

            this.raw.on("notify", (message) => {
                this.onNotification.emit(message)
            })

            this.raw.on("request", (request, callback) => {
                this._handleRequest(request, callback)
            })

            this.raw.on("disconnect", () => {
                this.onClose.emit()
            })

        }
    }
}
