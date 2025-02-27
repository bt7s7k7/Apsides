import { Constructor, ToReadonlyCollection } from "../../comTypes/types"
import { assertType } from "../../comTypes/util"
import { defaultDisposeAction } from "../../events/Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle } from "../../events/DisposableHandle"
import { EventEmitter } from "../../events/EventEmitter"
import { EventListener } from "../../events/EventListener"
import { ClientError } from "../../foundation/messaging/errors"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Mutation } from "../../struct/Mutation"
import { Struct } from "../../struct/Struct"
import { Deserializer, Serializer, Type } from "../../struct/Type"
import { RpcServer } from "../architecture/RpcServer"
import { ERR_INVALID_ACTION } from "../errors"

export class Api<T extends Struct.StructStatics = Struct.StructStatics> {
    protected readonly _actions: Api.ActionType<Type, Type>[] = []
    protected readonly _events: Api.EventType<Type>[] = []

    public readonly eventsLookup
    public readonly modelType

    public get actions() { return this._actions as ToReadonlyCollection<typeof this._actions> }
    public get events() { return this._events as ToReadonlyCollection<typeof this._events> }

    public makeController(): (new (...args: ConstructorParameters<typeof Api.Controller>) => Api._ControllerInstance<T>) & { api: Api } {
        const controllerBase = this.model as unknown as new (...args: any[]) => Api.Controller

        const events = this._events
        const actions = this._actions
        const actionsLookup = new Map(actions.map(v => [v.name, v]))
        const modelType = this.model.ref()
        const typeName = modelType.name
        const api = this

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
                public override readonly id: string | null,
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

            public static readonly api = api
        }


        return _ApiController as any
    }

    public makeControllerImpl<TClass>(ctor: Constructor<TClass>, impl: ThisType<TClass> & Api._ControllerImpl<TClass>) {
        Object.assign(ctor.prototype, impl)
    }

    constructor(
        public readonly model: T,
        api: Api._ApiDefinition,
    ) {
        for (const value of api) {
            if ("param" in value) {
                this._actions.push(value)
            } else {
                this._events.push(value)
            }
        }

        const eventsLookup = new Map(this._events.map(v => [v.name, v.type]))
        this.eventsLookup = eventsLookup as ToReadonlyCollection<typeof eventsLookup>
        this.modelType = this.model.ref()
    }

    public static handleWrapper: ((value: any) => any) | null = null
}

export namespace Api {
    export interface CallOptions {
        bindResult?: boolean | null
    }

    export type _UnwrapBoundResult<TResult, T> = T extends TResult ? (
        T
    ) : T[] extends TResult ? (
        TResult[]
    ) : Map<string, T> extends TResult ? (
        Map<string, TResult>
    ) : never

    export type _ControllerImpl<T> = {
        [P in keyof T as T[P] extends _ActionValue<Type, Type> ? P : never]: T[P] extends _ActionValue<infer TParam, infer TResult> ? (
            (param: Type.Extract<TParam>) => Promise<Type.Extract<TResult>>
        ) : never
    } & {
        _init?: () => Promise<void>
    }

    export type _ControllerInstance<T extends Struct.StructStatics> = InstanceType<T> & Api.Controller & {
        init(model: InstanceType<T>): Promise<void>
    }

    /** Base class for all API controllers. Do not construct or take a reference to this class, treat it as an interface only. Use `{@link Api.isController}` to verify types. */
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

        public static readonly api: Api
    }

    export function isController(value: unknown): value is Controller {
        return typeof value == "object" && value != null && "rpcServer" in value && "globalId" in value
    }

    export class ActionType<TParam extends Type, TResult extends Type> {
        constructor(
            public readonly name: string,
            public readonly param: TParam,
            public readonly result: TResult,
            public readonly desc: string | null,
        ) { }
    }

    export class EventType<T extends Type> {
        constructor(
            public readonly name: string,
            public readonly type: T,
        ) { }
    }

    abstract class _DefinitionBase<T> extends Type<T> {
        public verify(value: unknown): T {
            return value as T
        }

        protected _serialize(source: T, serializer: Serializer<unknown, unknown, unknown, unknown>): unknown {
            return Type.IGNORE_VALUE
        }
        protected _deserialize(handle: any, deserializer: Deserializer<unknown, unknown, unknown, unknown>): T {
            return Type.IGNORE_VALUE as T
        }

        public readonly [Struct.DECORATOR_FIELD] = true
    }

    declare const _ACTION: unique symbol

    export interface _ActionValue<TParam extends Type, TResult extends Type> {
        (param: Type.Extract<TParam>, options?: CallOptions): Promise<Type.Extract<TResult>>
        [_ACTION]: true
        [Struct.DECORATOR_FIELD]: true
    }

    export class _ActionDefinition<TParam extends Type, TResult extends Type> extends _DefinitionBase<_ActionValue<TParam, TResult>> {
        public readonly name = `(${this.param.name}) => ${this.result.name}`

        public getDefinition(indent: string): string {
            return indent + `(${this.param.definition}) => ${this.result.getDefinition(indent + "    ")}`
        }

        public default(): _ActionValue<TParam, TResult> {
            return (() => {
                throw new Error("Cannot execute action on a handle without a target")
            }) as any
        }

        constructor(
            public readonly param: TParam,
            public readonly result: TResult,
            public readonly desc: string | null
        ) { super() }
    }

    export function action<TParam extends Type, TResult extends Type>(param: TParam, result: TResult, desc: string | null = null): _ActionDefinition<TParam, TResult> {
        return new _ActionDefinition(param, result, desc)
    }

    export type _EventValue<TEvent extends Type> = EventEmitter<Type.Extract<TEvent>> & { [Struct.DECORATOR_FIELD]: true }

    export class _EventDefinition<TEvent extends Type> extends _DefinitionBase<_EventValue<TEvent>> {
        public readonly name = `(event)${this.type.name}`

        public getDefinition(indent: string): string {
            return indent + `(event)${this.type.definition}`
        }

        public default(): _EventValue<TEvent> {
            return new EventEmitter<any>() as any
        }

        constructor(
            public readonly type: TEvent,
        ) { super() }
    }

    export function event<T extends Type>(type: T) {
        return new _EventDefinition(type)
    }

    export type _ApiDefinition = (ActionType<any, any> | EventType<any>)[]

    export function define<T extends Struct.StructStatics>(model: T) {
        const api: _ApiDefinition = []

        for (const [key, prop] of Struct.getBaseType(model).propList) {
            if (prop instanceof _ActionDefinition) {
                api.push(new ActionType(key, prop.param, prop.result, prop.desc))
            } else if (prop instanceof _EventDefinition) {
                api.push(new EventType(key, prop.type))
            }
        }

        return new Api(model, api)
    }
}
