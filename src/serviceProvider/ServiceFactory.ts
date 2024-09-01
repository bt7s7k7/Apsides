import { ServiceProvider } from "./ServiceProvider"


declare const _SERVICE_KIND: unique symbol

export class ServiceKind<T> {
    declare readonly [_SERVICE_KIND]: T

    constructor(
        public readonly name: string
    ) { }
}

export interface ServiceFactory<T> {
    kind: ServiceKind<T>
    init(services: ServiceProvider): T
}
