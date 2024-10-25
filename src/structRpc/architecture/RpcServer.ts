import { ensureKey } from "../../comTypes/util"
import { DISPOSABLE_HANDLE, DisposableHandle, DisposableUser } from "../../events/DisposableHandle"
import { EventListener } from "../../events/EventListener"
import { ClientError } from "../../foundation/messaging/errors"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Mutation } from "../../struct/Mutation"
import { Struct } from "../../struct/Struct"
import { Api } from "../api/Api"
import { MutationTap } from "../api/MutationTap"
import { ApiConsistencyError, ERR_CONTROLLER_NOT_FOUND } from "../errors"
import { RpcMessage } from "./RpcMessage"
import { RpcSession } from "./RpcSession"

export class ControllerBinding implements DisposableUser {
    public removeHandle(handle: DisposableHandle): void {
        if (handle.value != this.controller) throw new ApiConsistencyError("Invalid DisposableHandle provided to ControllerBinding.removeHandle")

        // Remove handle is only called when the controller is disposed, remove our reference to prevent use after free
        this.controller = null!

        this.server["_removeBinding"](this)
    }

    constructor(
        public readonly id: number,
        public readonly server: RpcServer,
        public controller: Api.Controller | null,
        public readonly session: RpcSession | null
    ) { }

}

export class RpcServer extends EventListener {
    protected readonly _bindings = new Map<number, ControllerBinding>()
    protected readonly _controllers = new Map<string, Api.Controller>()
    protected _nextId = 0

    protected readonly _taps = new Map<string, Set<MutationTap>>()

    /** Registers a controller to be always available. To unregister it you'll have to dispose it. */
    public registerController(controller: Api.Controller) {
        this._createBinding(controller, null)
    }

    public async getController(type: string, id: string | null) {
        const globalId = type + (id != null ? "\x00" + id : "")

        const existing = this._controllers.get(globalId)
        if (existing != null) {
            return existing
        }

        throw new ClientError(`Cannot find controller ${JSON.stringify(type)} with ID ${JSON.stringify(id)}`, { code: ERR_CONTROLLER_NOT_FOUND })
    }

    public async makeController<T extends { init: (value: any) => Promise<void> }>(type: new (rpcServer: RpcServer, id: string | null) => T, initData: Parameters<T["init"]>[0]) {
        const controller = new type(this, null)
        await controller.init(initData)
        return controller
    }

    protected _removeBinding(binding: ControllerBinding) {
        if (!this._bindings.delete(binding.id)) throw new ApiConsistencyError(`Invalid binding id ${binding.id} for RpcServer._removeLocalBinding`)
        if (binding.session != null) {
            binding.session["_handleRemovedBinding"](binding)
        }

        const controller = binding.controller
        // Controller is null if the binding is removed due to controller being disposed
        if (controller == null) return

        const disposableHandle = controller[DISPOSABLE_HANDLE]
        disposableHandle.unregisterUser(binding)

        if (disposableHandle.getUserCount() == 0) {
            controller[Symbol.dispose]()
            this._controllers.delete(controller.globalId)
        }
    }

    protected _createBinding(controller: Api.Controller, session: RpcSession | null) {
        const registeredController = this._controllers.get(controller.globalId)
        if (registeredController == null) {
            this._controllers.set(controller.globalId, controller)
        } else if (registeredController != controller) {
            throw new ApiConsistencyError(`Adding binding to a controller, but the binding instance does not match the registered one`)
        }

        const binding = new ControllerBinding(this._nextId++, this, controller, session)
        this._bindings.set(binding.id, binding)
        controller[DISPOSABLE_HANDLE].registerUser(binding)
        return binding
    }

    protected _notify(controller: Api.Controller, mutations: Mutation[]) {
        const taps = this._taps.get(Struct.getBaseType(controller).name)
        if (taps) {
            for (const tap of taps) {
                tap.handleChanged(controller)
            }
        }

        for (const [session, bindings] of this._collectUsers(controller)) {
            session["_sendMessage"](new RpcMessage.ToClient.Notify({
                kind: "notify",
                bindings, mutations
            }))
        }
    }

    protected _emit(controller: Api.Controller, event: string, value: DeferredSerializationValue) {
        for (const [session, bindings] of this._collectUsers(controller)) {
            session["_sendMessage"](new RpcMessage.ToClient.Event({
                kind: "event",
                bindings, event, value
            }))
        }
    }

    protected _collectUsers(controller: Api.Controller) {
        const users = new Map<RpcSession, number[]>()

        for (const binding of controller[DISPOSABLE_HANDLE].getUsers()) {
            if (!(binding instanceof ControllerBinding)) continue
            // User session is null if this binding was created to register the controller using .registerController
            if (binding.session == null) continue
            ensureKey(users, binding.session, () => []).push(binding.id)
        }

        return users
    }

    public addTap<T extends typeof Api.Controller>(type: T): MutationTap<InstanceType<T>> {
        const baseType = Struct.getBaseType(type)
        const tap = new MutationTap<InstanceType<T>>(this, baseType.name)
        ensureKey(this._taps, tap.type, () => new Set()).add(tap as any)
        return tap
    }

    protected constructor(
        public readonly services: ServiceProvider
    ) { super() }

    public static readonly kind = new ServiceKind<RpcServer>("RpcServer")

    public static init(services: ServiceProvider) {
        return new RpcServer(services)
    }

}

RpcServer satisfies ServiceFactory<RpcServer>
