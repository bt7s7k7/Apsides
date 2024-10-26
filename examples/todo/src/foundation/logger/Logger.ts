import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"

export abstract class Logger {
    public info(text: TemplateStringsArray, ...values: any[]) {
        this._log("info", text, values)
    }

    public debug(text: TemplateStringsArray, ...values: any[]) {
        this._log("debug", text, values)
    }

    public warn(text: TemplateStringsArray, ...values: any[]) {
        this._log("warn", text, values)
    }

    public error(text: TemplateStringsArray, ...values: any[]) {
        this._log("error", text, values)
    }

    public critical(text: TemplateStringsArray, ...values: any[]) {
        this._log("critical", text, values)
    }

    protected abstract _log(prefix: Logger.Level, text: TemplateStringsArray, values: any[]): void

    public static readonly kind = new ServiceKind<Logger>("Logger")

    public static multicast(targetsGetter: (services: ServiceProvider) => Logger[]): ServiceFactory<Logger> {
        return {
            kind: this.kind,
            init(services) {
                return new _RedirectLogger(targetsGetter(services))
            },
        }
    }
}

class _RedirectLogger extends Logger {
    protected _log(prefix: Logger.Level, text: TemplateStringsArray, values: any[]): void {
        for (const target of this.targets) {
            target["_log"](prefix, text, values)
        }
    }

    constructor(
        public readonly targets: Logger[]
    ) { super() }
}

export namespace Logger {
    export type Level =
        | "debug"
        | "info"
        | "warn"
        | "error"
        | "critical"
}
