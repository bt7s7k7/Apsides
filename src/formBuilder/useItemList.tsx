import { mdiClose } from "@mdi/js"
import { Ref, computed, defineComponent, ref, shallowReactive } from "vue"
import { fuzzySearch } from "../comTypes/util"
import { Button, ButtonGroup, ButtonProps } from "../vue3gui/Button"
import { MenuTarget, ModalOptions, useDynamicsEmitter } from "../vue3gui/DynamicsEmitter"
import { MenuItem, MenuItemProps } from "../vue3gui/MenuItem"
import { TextField } from "../vue3gui/TextField"
import { useDebounce } from "../vue3gui/util"
import { FormDefinition, FormView } from "./FormView"

type _ItemAction<T> = Omit<ButtonProps.Function & MenuItemProps.Function, "onClick" | "onMouseDown"> & {
    onClick?(value: T, index: number, array: T[], event: MouseEvent): void
    onMouseDown?(value: T, index: number, array: T[], event: MouseEvent): void
}

export interface ItemListOptions<T> {
    /** List or getter of items to display */
    items: { value: T[] } | T[] | (() => T[])
    /** Getter or property name for item key, if not set the `"key"` property will be used */
    key?: keyof T | ((value: T, index: number, array: T[]) => (string | number))
    /** Getter or property name for item label, if not set the `"label"` property will be used */
    label?: keyof T | ((value: T, index: number, array: T[]) => string)
    /** Getter or property name for getting an icon, specify true to use `"icon"` property*/
    icon?: boolean | keyof T | ((value: T, index: number, array: T[]) => string)
    /** List of actions for an item */
    actions?: _ItemAction<T>[]
    /** Custom content to be rendered inside the item */
    customContent?: (value: T, index: number, array: T[]) => any
    /** Do not include label and actions in item, use `customContent` */
    noDefaultContent?: boolean
    /** Triggers on click event on item */
    onClick?: (value: T, index: number, array: T[], event: MouseEvent) => void
    /** Triggers on mousedown event on item */
    onMouseDown?: (value: T, index: number, array: T[], event: MouseEvent) => void
    /** Should a search bar be crated? */
    searchBar?: boolean
    /** Should return a string that will be searched against, if not set the label will be used */
    searchData?: (value: T, index: number, array: T[]) => string
    /** List of buttons to add to bar */
    globalActions?: ButtonProps.Function[]
    /** Additional props added to items */
    itemProps?: MenuItemProps.Style & ButtonProps.Style & { class?: any, style?: any }
    /** Content to be inserted before list items, be sure to include a key */
    header?: () => any
    /** Content to be inserted after list items, be sure to include a key */
    footer?: () => any
    /** Handle selecting of items on click */
    selectable?: boolean
    /** Fired when an item is selected */
    onSelected?(item: T): void
    /** Amount of milliseconds to wait until update */
    searchDebounceTimeout?: number
    /** Focuses the search bar textfield on mount */
    focusSearchBar?: boolean
}

export interface ItemList<T> extends FormDefinition {
    updateNow(items?: T[]): void
    searchQuery: string
    selected: T | null
}

let nextID = 0
export function useItemList<T>(options: ItemListOptions<T>) {
    const id = nextID++
    const getLabel = typeof options.label == "function" ? (
        options.label
    ) : typeof options.label == "string" ? (
        (item: T) => item[options.label as keyof T] as string
    ) : (
        (item: T) => (item as { label: string }).label as string
    )

    const getKey = typeof options.key == "function" ? (
        options.key
    ) : typeof options.key == "string" ? (
        (item: T) => item[options.key as keyof T] as string
    ) : (
        (item: T) => (item as { key: string }).key as string
    )

    const getIcon = !options.icon ? (
        null
    ) : typeof options.icon == "function" ? (
        options.icon
    ) : typeof options.icon == "string" ? (
        (item: T) => item[options.icon as keyof T] as string
    ) : (
        (item: T) => (item as { icon: string }).icon as string
    )

    const items = options.items instanceof Array ? (
        ref(options.items) as Ref<T[]>
    ) : typeof options.items == "function" ? (
        computed(options.items)
    ) : (
        options.items
    )

    const getSearchData = options.searchData ?? ((v, i, a) => String(getLabel(v, i, a)))

    const searchQuery = ref("")
    const searchQueryDebounced = useDebounce(searchQuery, {
        delay: options.searchDebounceTimeout ?? 100
    })

    const itemsFiltered = computed(() => {
        if (searchQueryDebounced.value == "") return items.value
        const filtered = fuzzySearch(searchQueryDebounced.value, items.value, getSearchData)
        return filtered.map(v => v.option)
    })

    const adaptAction = (action: _ItemAction<T>, item: T, i: number, a: T[]) => {
        const actions = {}
        Object.assign(actions, action)

        if ("onClick" in actions) {
            const onClick = actions.onClick as NonNullable<_ItemAction<T>["onClick"]>
            actions.onClick = (event: MouseEvent) => onClick(item, i, a, event)
        }

        if ("onMouseDown" in actions) {
            const onMouseDown = actions.onMouseDown as NonNullable<_ItemAction<T>["onMouseDown"]>
            actions.onMouseDown = (event: MouseEvent) => onMouseDown(item, i, a, event)
        }

        return actions
    }

    function onClick(item: T, i: number, a: T[], event: MouseEvent) {
        if (options.selectable) {
            list.selected = item
            options.onSelected?.(item)
        }

        options.onClick?.(item, i, a, event)
    }

    const list = shallowReactive<ItemList<T>>({
        render() {
            return (
                <div>
                    <div class="flex column absolute-fill overflow-auto">
                        {(options.searchBar || options.globalActions) && (
                            <div class="border-bottom flex row sticky" key="_bar">
                                {options.searchBar && (
                                    <TextField focus={options.focusSearchBar} vModel={searchQuery.value} placeholder="Search..." class="flex-fill" clear>
                                        <Button
                                            icon={mdiClose} clear
                                            class={[searchQuery.value == "" && "invisible ignored"]}
                                            onClick={() => (searchQuery.value = "", searchQueryDebounced.updateNow())}
                                        />
                                    </TextField>
                                )}
                                {options.globalActions && (
                                    <ButtonGroup clear>
                                        {options.globalActions.map(action => (
                                            <Button {...action} />
                                        ))}
                                    </ButtonGroup>
                                )}
                            </div>
                        )}
                        {options.header?.()}
                        {itemsFiltered.value.map((item, i, a) => (
                            <MenuItem
                                icon={getIcon?.(item, i, a)}
                                clear
                                {...options.itemProps}
                                key={getKey(item, i, a)}
                                onClick={(event: MouseEvent) => onClick(item, i, a, event)}
                                class={[options.itemProps?.class, list.selected == item && "bg-primary-translucent"]}
                                onMouseDown={(event: MouseEvent) => options.onMouseDown?.(item, i, a, event)}
                                data-item-list={id}
                            >
                                {!options.noDefaultContent && <>
                                    {getLabel(item, i, a)}
                                    {options.actions?.map(action => (
                                        <MenuItem {...adaptAction(action, item, i, a)} />
                                    ))}
                                </>}
                                {options.customContent?.(item, i, a)}
                            </MenuItem>
                        ))}
                        {options.footer?.()}
                    </div>
                </div>
            )
        },
        updateNow(newItems) {
            if (newItems == null) {
                options.items instanceof Array ? (
                    ref(options.items) as Ref<T[]>
                ) : typeof options.items == "function" ? (
                    computed(options.items)
                ) : (
                    options.items
                )
            } else {
                (items as Ref<T[]>).value = newItems
            }
        },
        get searchQuery() { return searchQueryDebounced.value },
        set searchQuery(value) { searchQuery.value = value; searchQueryDebounced.updateNow() },
        selected: null
    })
    return list
}

export interface SearchPopupOptions<T> {
    list: ItemListOptions<T>,
    formClassOverride?: any
    modalOptions?: ModalOptions
}
export function useSearchPopup<T>(options: SearchPopupOptions<T>) {
    const emitter = useDynamicsEmitter()

    return {
        open(target: MenuTarget) {
            const menu = emitter.menu(target, defineComponent({
                name: "SearchPopup",
                setup(props, ctx) {
                    const list = useItemList({
                        searchBar: true,
                        focusSearchBar: true,
                        ...options.list,
                        onClick(...args) {
                            menu.controller.close()
                            options.list.onClick?.(...args)
                        }
                    })

                    return () => (
                        <FormView class={options.formClassOverride ?? "w-200 h-300"} form={list} />
                    )
                },
            }), {
                props: {
                    backdropCancels: true,
                    noTransition: true,
                    class: "bg-white rounded border",
                    noDefaultStyle: true,
                    ...options.modalOptions
                }
            })
        }
    }
}
