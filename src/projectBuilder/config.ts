
export type PackageJson = {
    name: string
    version: string
    devDependencies: Record<string, string>
    dependencies: Record<string, string>
    optionalDependencies?: Record<string, string>
} & Record<string, any>

export interface TSConfig {
    compilerOptions: any
    include?: string[]
    exclude?: string[]
}
