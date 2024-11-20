import { h } from "vue"
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router"
import { ComponentsPage } from "../apsides/components/ComponentsPage"
import { StructPage } from "../apsides/struct/StructPage"
import { FormPage } from "../apsides/form/FormPage"
import { Home } from "../apsides/Home"
import { EditorPage } from "../apsides/EditorPage"

const routes: RouteRecordRaw[] = [
    {
        name: "Home",
        path: "/",
        component: Home,
    },
    {
        name: "Form",
        path: "/form",
        component: FormPage,
    },
    {
        name: "Editor",
        path: "/editor",
        component: EditorPage,
    },
    {
        name: "Components",
        path: "/ui",
        component: ComponentsPage,
    },
    {
        name: "Struct",
        path: "/struct",
        component: StructPage,
    },
    {
        name: "404",
        component: { setup: () => () => h("pre", { class: "m-4" }, "Page not found") },
        path: "/:page(.*)*",
    },
]

export const router = createRouter({
    history: createWebHistory(),
    routes,
})
