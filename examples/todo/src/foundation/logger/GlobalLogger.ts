import { ServiceFactory } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { Logger } from "./Logger"

export class GlobalLogger extends Logger {
    protected _log(prefix: Logger.Level, text: TemplateStringsArray, values: any[]): void {
        const args = [text[0].trim()]
        if (args[0].length == 0) args.pop()

        for (let i = 1; i < text.length; i++) {
            args.push(values[i - 1])
            args.push(text[i].trim())
        }

        if (prefix == "info" || prefix == "debug") {
            // eslint-disable-next-line no-console
            console.log(...args)
        } else if (prefix == "warn") {
            // eslint-disable-next-line no-console
            console.warn(...args)
        } else {
            // eslint-disable-next-line no-console
            console.error(...args)
        }
    }

    public static init(services: ServiceProvider) {
        return new GlobalLogger()
    }
}

GlobalLogger satisfies ServiceFactory<Logger>
