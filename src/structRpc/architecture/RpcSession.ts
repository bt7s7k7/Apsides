import { unreachable } from "../../comTypes/util"
import { EventListener } from "../../events/EventListener"
import { ClientError } from "../../foundation/messaging/errors"
import { MessageTransport } from "../../foundation/messaging/MessageTransport"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Struct } from "../../struct/Struct"
import { ApiConsistencyError, ERR_CONTROLLER_NOT_FOUND } from "../errors"
import { RpcMessage } from "./RpcMessage"
import { ControllerBinding, RpcServer } from "./RpcServer"

export class RpcSession extends EventListener {
    protected readonly _transport = this._services.get(MessageTransport.kind)
    protected readonly _server = this._services.get(RpcServer.kind)

    protected readonly _bindings = new Map<number, ControllerBinding>()

    protected _handleRemovedBinding(binding: ControllerBinding) {
        if (!this._bindings.delete(binding.id)) throw new ApiConsistencyError(`Invalid binding id ${binding.id} for RpcSession._handleRemovedBinding`)
    }

    protected _sendMessage(message: RpcMessage.ToClient) {
        this._transport.sendNotification(message.serialize())
    }

    protected _getBindingById(id: number) {
        const binding = this._bindings.get(id)
        if (binding == null) {
            throw new ClientError(`Invalid binding ${id}`, { code: ERR_CONTROLLER_NOT_FOUND })
        }
        return binding
    }

    public [Symbol.dispose]() {
        for (const binding of this._bindings.values()) {
            this._server["_removeBinding"](binding)
        }
        this._bindings.clear()

        super[Symbol.dispose]()
    }

    protected constructor(
        protected readonly _services: ServiceProvider
    ) {
        super()

        this._transport.onRequest.add(this, (request) => {
            request.completeWith(async () => {
                const data = RpcMessage.ToServer_t.deserialize(request.data)
                if (data.kind == "get") {
                    const controller = await this._server.getController(data.type, data.id ?? null)

                    return new RpcMessage.ToClient.Result({
                        kind: "result",
                        value: DeferredSerializationValue.prepareSerialization(controller, Struct.getType(controller))
                    }).serialize()
                } else if (data.kind == "bind") {
                    const controller = await this._server.getController(data.type, data.id ?? null)
                    const binding = this._server["_createBinding"](controller, this)
                    this._bindings.set(binding.id, binding)

                    return new RpcMessage.ToClient.Binding({
                        kind: "binding",
                        value: DeferredSerializationValue.prepareSerialization(controller, Struct.getType(controller)),
                        bindingId: binding.id
                    }).serialize()
                } else if (data.kind == "unbind") {
                    const binding = this._getBindingById(data.bindingId)
                    this._server["_removeBinding"](binding)
                } else if (data.kind == "call") {
                    const controller = await this._server.getController(data.type, data.id ?? null)
                    const value = await controller["_handleCall"](data.action, data.argument)

                    return new RpcMessage.ToClient.Result({
                        kind: "result",
                        value
                    }).serialize()
                } else if (data.kind == "callBound") {
                    const binding = this._getBindingById(data.bindingId)
                    const controller = binding.controller ?? unreachable()
                    const value = await controller["_handleCall"](data.action, data.argument)

                    return new RpcMessage.ToClient.Result({
                        kind: "result",
                        value
                    }).serialize()
                } else unreachable()
            })
        })
    }

    public static readonly kind = new ServiceKind<RpcSession>("RpcSession")

    public static init(services: ServiceProvider) {
        return new RpcSession(services)
    }
}

RpcSession satisfies ServiceFactory<RpcSession> 
