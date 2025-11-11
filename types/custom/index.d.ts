declare module 'd3' {
  const d3: any
  export = d3
}

declare module 'd3-*' {
  const mod: any
  export = mod
}

declare module 'estree' {
  const estree: any
  export = estree
}

declare module 'json5' {
  const json5: any
  export = json5
}

declare module 'phoenix' {
  const phoenix: any
  export = phoenix
}

declare module 'prop-types' {
  const propTypes: any
  export = propTypes
}

declare module 'next/link' {
  const Link: any
  export default Link
}

declare module 'next/navigation' {
  export const useRouter: () => any
  export const usePathname: () => string
  export const redirect: (...args: any[]) => never
}

declare module 'next/image' {
  const NextImage: any
  export default NextImage
}

declare module 'next/dynamic' {
  const dynamic: any
  export default dynamic
}

declare module 'next/server' {
  export const NextResponse: any
  export type NextResponse<T = any> = any
  export type NextRequest = any
}

declare module 'next/font/google' {
  export const Inter: (...args: any[]) => { className: string }
}

declare module 'react' {
  export type ReactNode = any
  export interface FC<P = any> {
    (props: P & { children?: ReactNode }): any
  }
  export type FormEvent<T = any> = any
  export interface ChangeEvent<T = any> extends FormEvent<T> {}
  export interface MouseEvent<T = any> extends FormEvent<T> {}
  export interface RefObject<T> {
    current: T | null
  }
  export type Dispatch<A> = (value: A) => void
  export type SetStateAction<S> = S | ((prev: S) => S)
  export function useState<S = any>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>]
  export function useEffect(effect: (...args: any[]) => any, deps?: any[]): void
  export function useMemo<T>(factory: () => T, deps?: any[]): T
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T
  export function useContext<T>(ctx: any): T
  export function useRef<T = any>(initialValue?: T): RefObject<T>
  export function useId(): string
  export function useTransition(): [boolean, (cb: () => void) => void]
  export const Suspense: any
  export interface Context<T> {
    Provider: FC<{ value: T }>
    Consumer: FC<{ children: (value: T) => ReactNode }>
  }
  export function createContext<T>(defaultValue: T): Context<T>
  export function createElement(type: any, props?: any, ...children: any[]): any
  export const Fragment: any
  export interface HTMLAttributes<T> extends Record<string, any> {}
  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {}
  export interface InputHTMLAttributes<T> extends HTMLAttributes<T> {}
  const React: {
    createElement: typeof createElement
    Fragment: typeof Fragment
    useState: typeof useState
    useEffect: typeof useEffect
    useMemo: typeof useMemo
    useCallback: typeof useCallback
    useContext: typeof useContext
    useRef: typeof useRef
    useId: typeof useId
    useTransition: typeof useTransition
    Suspense: typeof Suspense
  }
  export default React
}

declare namespace React {
  type ReactNode = any
  type FC<P = any> = (props: P) => any
  type FormEvent<T = any> = any
  interface ChangeEvent<T = any> extends FormEvent<T> {}
  interface MouseEvent<T = any> extends FormEvent<T> {}
  interface RefObject<T> {
    current: T | null
  }
  type Dispatch<A> = (value: A) => void
  type SetStateAction<S> = S | ((prev: S) => S)
  interface Context<T> {
    Provider: FC<{ value: T }>
    Consumer: FC<{ children: (value: T) => ReactNode }>
  }
  function createContext<T>(defaultValue: T): Context<T>
}

declare module 'react-dom' {
  const ReactDOM: any
  export default ReactDOM
  export const createPortal: any
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any
  }
  interface ElementAttributesProperty {
    props: any
  }
  interface IntrinsicAttributes {
    key?: any
  }
}

declare module 'zod' {
  const z: any
  export { z }
  export type infer<T> = any
  export type ZodTypeAny = any
  export class ZodError extends Error {}
  export default z
}

declare namespace z {
  type infer<T> = any
}

declare module 'date-fns' {
  export const format: (...args: any[]) => string
  export const startOfDay: (...args: any[]) => Date
  export const endOfDay: (...args: any[]) => Date
  export const parseISO: (...args: any[]) => Date
  export const addDays: (...args: any[]) => Date
  export const subDays: (...args: any[]) => Date
  export const formatISO: (...args: any[]) => string
}

declare module 'lucide-react' {
  export const Home: any
  export const HeartPulse: any
  export const User: any
  export const Plus: any
  export const Gift: any
  export const BookOpen: any
  export const Users: any
  export const X: any
  export const Settings: any
  export const Activity: any
  export const Bell: any
  export const Brain: any
  export const ShieldCheck: any
  export const Circle: any
  export const ChevronDown: any
  export const ChevronUp: any
  export const ChevronRight: any
  export const Shield: any
  export const Bot: any
  export const BookMarked: any
  export const Info: any
}

declare module 'recharts' {
  export const ResponsiveContainer: any
  export const LineChart: any
  export const Line: any
  export const BarChart: any
  export const Bar: any
  export const XAxis: any
  export const YAxis: any
  export const CartesianGrid: any
  export const Tooltip: any
  export const Legend: any
}

declare module 'pg' {
  export class Pool {
    constructor(config?: any)
    connect(): Promise<any>
    query<T = any>(...args: any[]): Promise<{ rows: T[] }>
    end(): Promise<void>
  }
  export interface QueryResult<T = any> {
    rows: T[]
  }
}

declare module 'clsx' {
  export type ClassValue = any
  export function clsx(...inputs: any[]): string
  export default clsx
}

declare module 'tailwind-merge' {
  export function twMerge(...inputs: any[]): string
  export default twMerge
}

declare module 'openai' {
  export default class OpenAI {
    constructor(config?: any)
    responses: any
    chat: any
  }
}

declare module 'next/headers' {
  export const cookies: () => any
  export const headers: () => any
}

declare module 'tailwindcss' {
  export interface Config {
    content?: any
    theme?: any
    plugins?: any
    [key: string]: any
  }
  const tailwind: { config?: (cfg: Config) => any }
  export default tailwind
}

declare module 'vitest' {
  export const describe: (...args: any[]) => void
  export const it: (...args: any[]) => void
  export const test: (...args: any[]) => void
  export const expect: any
  export const beforeAll: (...args: any[]) => void
  export const afterAll: (...args: any[]) => void
  export const beforeEach: (...args: any[]) => void
  export const afterEach: (...args: any[]) => void
  export const vi: any
}

declare module 'vitest/config' {
  const defineConfig: (...args: any[]) => any
  export { defineConfig }
  export default defineConfig
}

declare module 'use-sync-external-store' {
  const useSyncExternalStore: any
  export = useSyncExternalStore
}

declare module 'ws' {
  const ws: any
  export = ws
}

declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.svg' {
  const url: string
  export default url
}
