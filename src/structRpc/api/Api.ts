import { Constructor } from "../../comTypes/types"
import { assertType, objectMap } from "../../comTypes/util"
import { defaultDisposeAction } from "../../events/Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle } from "../../events/DisposableHandle"
import { EventEmitter } from "../../events/EventEmitter"
import { EventListener } from "../../events/EventListener"
import { ClientError } from "../../foundation/messaging/errors"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Mutation } from "../../struct/Mutation"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"
import { RpcClient } from "../architecture/RpcClient"
import { RpcMessage } from "../architecture/RpcMessage"
import { RpcServer } from "../architecture/RpcServer"
import { ApiConsistencyError, ERR_INVALID_ACTION } from "../errors"

export class Api<T extends Struct.StructStatics, TApi extends Api._ApiConstraint> {
    protected readonly _actions: Api.ActionType<Type, Type>[] = []
    protected readonly _events: Api.EventType<Type>[] = []

    public makeProxy(): new (...args: ConstructorParameters<typeof Api.Proxy>) => Api._ProxyInstance<T, TApi> {
        const proxyBase = this.model as unknown as new (...args: any[]) => Api.Proxy

        const events = this._events
        const eventsLookup = new Map(this._events.map(v => [v.name, v.type]))
        const modelType = this.model.ref()
        const typeName = modelType.name

        class _ApiProxy extends proxyBase {
            public override readonly [DISPOSABLE_HANDLE] = new DisposableHandle(this)

            public override async bind(): Promise<void> {
                if (this._rpcBindingId != null) throw new ApiConsistencyError("Cannot call .bind on an already bound proxy instance")
                const result = await this.rpcClient["_bind"](this, typeName, this.id)
                const remoteValue = result.value.getValue(modelType)
                const bindingId = result.bindingId
                Object.assign(this, remoteValue)
                this._rpcBindingId = bindingId
            }

            public override async sync(): Promise<void> {
                const result = await this.rpcClient["_sync"](typeName, this.id)
                const remoteValue = result.value.getValue(modelType)
                Object.assign(this, remoteValue)
            }

            public override async unbind(): Promise<void> {
                if (this._rpcBindingId == null) throw new ApiConsistencyError("Cannot call .unbind on an unbound proxy instance")
                const bindingId = this._rpcBindingId
                this._rpcBindingId = null
                await this.rpcClient["_unbind"](bindingId)
            }

            public override[Symbol.dispose](): void {
                this.unbind()
                defaultDisposeAction(this)
            }

            protected override _handleEvent(event: RpcMessage.ToClient.Event): void {
                const eventName = event.event
                const eventType = eventsLookup.get(eventName)
                if (eventType == null) throw new ClientError(`Called Api.Proxy._handleEvent with invalid event ${JSON.stringify(eventName)}`)
                const eventValue = event.value.getValue(eventType)
                    ;
                ((this as any)[eventName] as EventEmitter<any>).emit(eventValue)
            }

            protected override _handleNotification(event: RpcMessage.ToClient.Notify): void {
                const mutations = event.mutations
                for (const mutation of mutations) {
                    Mutation.apply(this, modelType, mutation)
                }
            }

            constructor(
                public override readonly rpcClient: RpcClient,
                public override id: string | null = null
            ) {
                super(null)

                for (const event of events) {
                    (this as any)[event.name] = new EventEmitter()
                }
            }

            protected override _rpcBindingId: number | null = null
        }

        for (const action of this._actions) {
            (_ApiProxy.prototype as any)[action.name] = async function (this: _ApiProxy, argument: any) {
                const argumentData = DeferredSerializationValue.prepareSerialization(argument, action.param)
                const resultData = await this.rpcClient["_call"](typeName, this.id, this._rpcBindingId, action.name, argumentData)
                const result = resultData.value.getValue(action.result)
                return result
            }
        }

        return _ApiProxy as any
    }

    public makeController(): new (...args: ConstructorParameters<typeof Api.Controller>) => Api._ControllerInstance<T, TApi> {
        const controllerBase = this.model as unknown as new (...args: any[]) => Api.Controller

        const events = this._events
        const actions = this._actions
        const actionsLookup = new Map(actions.map(v => [v.name, v]))
        const modelType = this.model.ref()
        const typeName = modelType.name

        class _ApiController extends controllerBase {
            public override readonly [DISPOSABLE_HANDLE] = new DisposableHandle(this)
            public override globalId = typeName + (this.id == null ? "" : "\x00" + this.id)

            public override[Symbol.dispose](): void {
                defaultDisposeAction(this)
            }

            public async init(data: any) {
                Object.assign(this, data)
                if ("_init" in this && assertType<() => Promise<void>>(this._init)) {
                    await this._init()
                }
                this.globalId = typeName + (this.id == null ? "" : "\x00" + this.id)
            }

            protected override _mutate(mutation: Mutation[]): void
            protected override _mutate<T>(this: T, thunk: (instance: T) => void): void
            protected override _mutate(value: Mutation[] | ((value: any) => void)): void {
                let mutations = typeof value == "function" ? (
                    Mutation.create(this, modelType, value)
                ) : (
                    value
                )

                // If the mutation was provided outright it would not have been locally
                // applied by Mutation.create, so we apply it manually here
                if (typeof value != "function") {
                    for (const mutation of mutations) Mutation.apply(this, modelType, mutation)
                }

                this.rpcServer["_notify"](this, mutations)
            }

            protected override async _handleCall(actionName: string, argumentData: DeferredSerializationValue): Promise<DeferredSerializationValue> {
                const action = actionsLookup.get(actionName)
                if (action == null) throw new ClientError(`Invalid action ${JSON.stringify(actionName)}`, { code: ERR_INVALID_ACTION })

                const argument = argumentData.getValue(action.param)
                const result = await (this as any as Record<string, (arg: any) => Promise<any>>)[actionName](argument)

                const resultData = DeferredSerializationValue.prepareSerialization(result, action.result)
                return resultData
            }

            constructor(
                public override readonly rpcServer: RpcServer,
                public override readonly id: string | null
            ) {
                super(null)

                for (const event of events) {
                    const emitter = new EventEmitter();
                    (this as any)[event.name] = emitter
                    emitter.add(null, (eventValue) => {
                        this.rpcServer["_emit"](this, event.name, DeferredSerializationValue.prepareSerialization(eventValue, event.type))
                    })
                }
            }
        }


        return _ApiController as any
    }

    public makeControllerImpl<TClass>(ctor: Constructor<TClass>, impl: ThisType<TClass> & Api._ControllerImpl<TApi>) {
        Object.assign(ctor.prototype, impl)
    }

    constructor(
        public readonly model: T,
        api: TApi
    ) {
        for (const value of Object.values(api)) {
            if ("param" in value) {
                this._actions.push(value)
            } else {
                this._events.push(value)
            }
        }
    }
}

export namespace Api {
    export type ProxyConstructor = ReturnType<Api<Struct.StructStatics<Type<{}>>, _ApiConstraint>["makeProxy"]>

    export type _ApiConstraint = Record<string, Api.ActionType<Type, Type> | Api.EventType<Type>>

    export type _ProxyProps<T extends _ApiConstraint> = {
        readonly [P in keyof T]: T[P] extends ActionType<infer TParam, infer TResult> ? (
            (param: Type.Extract<TParam>) => Promise<Type.Extract<TResult>>
        ) : T[P] extends EventType<infer T> ? (
            EventEmitter<Type.Extract<T>>
        ) : never
    }

    export type _ProxyInstance<T extends Struct.StructStatics, TApi extends Api._ApiConstraint> = InstanceType<T> & _ProxyProps<TApi> & Api.Proxy

    export type _ControllerProps<T extends _ApiConstraint> = {
        readonly [P in keyof T]: T[P] extends ActionType<infer TParam, infer TResult> ? (
            (param: Type.Extract<TParam>) => Promise<Type.Extract<TResult>>
        ) : T[P] extends EventType<infer T> ? (
            EventEmitter<Type.Extract<T>>
        ) : never
    }

    export type _ControllerImpl<T extends _ApiConstraint> = {
        [P in keyof T as T[P] extends ActionType<Type, Type> ? P : never]: T[P] extends ActionType<infer TParam, infer TResult> ? (
            (param: Type.Extract<TParam>) => Promise<Type.Extract<TResult>>
        ) : never
    } & {
        _init?: () => Promise<void>
    }

    export type _ControllerInstance<T extends Struct.StructStatics, TApi extends Api._ApiConstraint> = InstanceType<T> & _ControllerProps<TApi> & Api.Controller & {
        init(model: InstanceType<T>): Promise<void>
    }

    /** Base class for all API proxies. Do not construct or take a reference to this class, treat it as an interface only. */
    export declare class Proxy implements EventListener {
        protected _rpcBindingId: number | null
        public readonly rpcClient: RpcClient
        public readonly id: string | null

        public readonly [DISPOSABLE_HANDLE]: DisposableHandle<this>
        public [Symbol.dispose](): void

        /** Fetches remote state and subscribes to events and updates this instance on mutations */
        public bind(): Promise<void>
        /** Fetches remote state */
        public sync(): Promise<void>
        /** Unsubscribes from events and notifications of mutations */
        public unbind(): Promise<void>

        protected _handleEvent(event: RpcMessage.ToClient.Event): void
        protected _handleNotification(event: RpcMessage.ToClient.Notify): void

        constructor(client: RpcClient, id: string | null)
    }

    /** Base class for all API controllers. Do not construct or take a reference to this class, treat it as an interface only. */
    export declare class Controller implements EventListener {
        public readonly rpcServer: RpcServer
        public readonly id: string | null
        public readonly globalId: string

        public readonly [DISPOSABLE_HANDLE]: DisposableHandle<this>
        public [Symbol.dispose](): void

        protected _mutate(mutations: Mutation[]): void
        protected _mutate<T>(this: T, thunk: (instance: T) => void): void

        protected _handleCall(action: string, argument: DeferredSerializationValue): Promise<DeferredSerializationValue>

        constructor(server: RpcServer, id: string | null)
    }

    export class ActionType<TParam extends Type, TResult extends Type> {
        constructor(
            public readonly name: string,
            public readonly param: TParam,
            public readonly result: TResult,
        ) { }
    }

    export class EventType<T extends Type> {
        constructor(
            public readonly name: string,
            public readonly type: T
        ) { }
    }

    export function action<TParam extends Type, TResult extends Type>(param: TParam, result: TResult): _ActionDefinition<TParam, TResult> {
        return { kind: "action", param, result }
    }
    export type _ActionDefinition<TParam extends Type, TResult extends Type> = { kind: "action", param: TParam, result: TResult }

    export function event<T extends Type>(type: T) {
        return { kind: "event" as const, type }
    }
    export type _EventDefinition<T> = { kind: "event", type: T }

    export type _ApiDefinition = _ActionDefinition<any, any> | _EventDefinition<any>

    type _CreateApi<T extends _ApiDefinition> =
        T extends _EventDefinition<any> ? (
            EventType<T["type"]>
        ) : T extends _ActionDefinition<any, any> ? (
            ActionType<T["param"], T["result"]>
        ) : never

    export function define<T extends Struct.StructStatics, const TApi extends Record<string, _ApiDefinition>>(model: T, apiDefinition: TApi) {

        const api = objectMap(apiDefinition, (value, key) => (
            value.kind == "action" ? (
                new ActionType(key as string, value.param, value.result)
            ) : (
                new EventType(key as string, value.type)
            )
        )) as { [P in keyof TApi]: _CreateApi<TApi[P]> }

        return new Api(model, api)
    }
}
