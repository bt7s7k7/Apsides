import { serveStatic } from "@hono/node-server/serve-static"
import { Logger } from "./foundation/logger/Logger"
import { TerminalLogger } from "./foundation/logger/TerminalLogger"
import { HonoServer } from "./honoService/HonoServer"
import documentationPage from "./restTransport/page.html"
import { RestTransportServer } from "./restTransport/RestTransportServer"
import { AsyncInitializationQueue } from "./serviceProvider/AsyncInitializationQueue"
import { ServiceLoader } from "./serviceProvider/ServiceLoader"
import { SocketIOServer } from "./socketIOTransport/SocketIOServer"
import { RpcServer } from "./structRpc/architecture/RpcServer"
import { RpcSession } from "./structRpc/architecture/RpcSession"
import { ENV } from "./todoExample/ENV"
import { TodoListController } from "./todoExample/todoList/TodoListController"
import { TodoManagerController } from "./todoExample/todoManager/TodoManagerController"

const logger = new TerminalLogger()
logger.info`Starting ${ENV}`

const scope = new ServiceLoader()
    .provide(Logger.kind, logger)
    .add(HonoServer.make({
        serve: { port: +ENV.PORT }
    }))
    .add(SocketIOServer.make(async (connection) => {
        logger.info`Connection from ${connection.raw.conn.remoteAddress}`
        using services = connection.makeServiceLoader()
            .add(RpcSession)
            .load()

        await connection.onClose.asPromise()
        logger.info`Disconnected from ${connection.raw.conn.remoteAddress}`
    }))
    .add(RpcServer)
    .add(TodoManagerController)
    .add(RestTransportServer.make({
        controllers: [TodoManagerController, TodoListController],
        documentationPage
    }))
    .load()

const { app } = scope.get(HonoServer.kind)
app.get('/*', serveStatic({
    root: './dist'
}))

await scope.tryGet(AsyncInitializationQueue.kind)?.awaitAll()

logger.info`Ready.`
