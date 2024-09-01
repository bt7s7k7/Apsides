import { delayedPromise } from "./comTypes/util"
import { Logger } from "./foundation/logger/Logger"
import { TerminalLogger } from "./foundation/logger/TerminalLogger"
import { DebugMessageTransport } from "./foundation/messaging/DebugMessageTransport"
import { MessageTransport } from "./foundation/messaging/MessageTransport"
import { AsyncInitializationQueue } from "./serviceProvider/AsyncInitializationQueue"
import { ServiceLoader } from "./serviceProvider/ServiceLoader"
import { RpcClient } from "./structRpc/architecture/RpcClient"
import { RpcServer } from "./structRpc/architecture/RpcServer"
import { RpcSession } from "./structRpc/architecture/RpcSession"
import { TodoList, TodoListProxy } from "./todoExample/TodoList"
import { TodoManagerController, TodoManagerProxy } from "./todoExample/TodoManager"

const [serverTransport, clientTransport] = DebugMessageTransport.makePair()

const services = new ServiceLoader()
    .add(TerminalLogger)
    .load()

const logger = services.get(Logger.kind)
logger.info`Starting ${{
    mode: import.meta.env.MODE
}}`

const serverScope = services.makeTransientLoader()
    .add(RpcServer)
    .add(TodoManagerController)
    .load()

await serverScope.get(AsyncInitializationQueue.kind).awaitAll()

async function createConnection(messageTransport: MessageTransport) {
    using sessionScope = serverScope.makeTransientLoader()
        .add(RpcSession)
        .provide(MessageTransport.kind, messageTransport)
        .load()

    await messageTransport.onClose.asPromise(null)
    logger.info`Server detected disconnect`
}

const clientScope = services.makeTransientLoader()
    .add(RpcClient)
    .provide(MessageTransport.kind, clientTransport)
    .load()

createConnection(serverTransport)

void async function () {
    logger.info`Starting test`
    const client = clientScope.get(RpcClient.kind)
    const todoManger = client.getEmptyProxy(TodoManagerProxy)
    const listId = await todoManger.createList({ label: "New List" })
    logger.info`Step 0: ${listId}`
    const list = await client.getBoundProxy(TodoListProxy, listId)
    logger.info`Step 1: ${TodoList.baseType.clone(list)}`
    await list.setLabel("Label 2")
    logger.info`Step 2: ${TodoList.baseType.clone(list)}`
    await delayedPromise(100)
    clientScope[Symbol.dispose]()
    logger.info`Client disconnected`
}()
