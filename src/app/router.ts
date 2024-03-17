import { h } from "vue"
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router"
import { ComponentsPage } from "../apsides/components/ComponentsPage"
import { FormPage } from "../apsides/form/FormPage"
import { Home } from "../apsides/Home"

const routes: RouteRecordRaw[] = [
    {
        name: "Home",
        path: "/",
        component: Home
    },
    {
        name: "Form",
        path: "/form",
        component: FormPage
    },
    {
        name: "Components",
        path: "/ui",
        component: ComponentsPage
    },
    {
        name: "404",
        component: { setup: () => () => h("pre", { class: "m-4" }, "Page not found") },
        path: "/:page(.*)*"
    }
]

export const router = createRouter({
    history: createWebHistory(),
    routes
})
