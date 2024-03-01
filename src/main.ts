import { createApp } from "vue"
import { App } from "./app/App"
import { router } from "./app/router"
import { LIGHT_THEME } from "./vue3gui/theme/light"
import "./vue3gui/theme/light.scss"
import { vue3gui } from "./vue3gui/vue3gui"

const app = createApp(App)

app.use(router)
app.use(vue3gui, {
    theme: LIGHT_THEME
})

app.mount("#app")

