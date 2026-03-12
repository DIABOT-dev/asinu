declare namespace NodeJS {
  type Timeout = any
  interface ProcessEnv {
    [key: string]: string | undefined
  }
  interface ReadableStream {
    pipe?(dest: any): any
  }
}

declare var process: {
  env: NodeJS.ProcessEnv
  argv: string[]
  cwd(): string
  exit(code?: number): void
}

declare var module: any
declare var exports: any
declare var __dirname: string
declare var __filename: string

declare function require(id: string): any

declare const Buffer: {
  from(input: string | ArrayBuffer | ArrayBufferView, encoding?: string): any
  alloc(size: number): any
  byteLength(str: string, encoding?: string): number
  isBuffer(obj: any): obj is any
}

type Buffer = any

declare var global: any

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): NodeJS.Timeout
declare function clearTimeout(timeoutId: NodeJS.Timeout): void
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): NodeJS.Timeout
declare function clearInterval(timeoutId: NodeJS.Timeout): void
declare function setImmediate(handler: (...args: any[]) => void, ...args: any[]): NodeJS.Timeout
declare function clearImmediate(handle: NodeJS.Timeout): void

declare module 'fs' {
  const fs: any
  export function readFileSync(...args: any[]): any
  export function writeFileSync(...args: any[]): any
  export default fs
}

declare module 'fs/promises' {
  const fs: any
  export function readFile(...args: any[]): Promise<any>
  export function writeFile(...args: any[]): Promise<void>
  export default fs
}

declare module 'path' {
  const path: any
  export function join(...args: any[]): string
  export default path
}

declare module 'os' {
  const os: any
  export = os
}

declare module 'crypto' {
  const crypto: any
  export function createHash(...args: any[]): any
  export default crypto
}

declare module 'child_process' {
  const cp: any
  export = cp
}

declare module 'url' {
  const url: any
  export = url
}

declare module 'http' {
  const http: any
  export = http
}

declare module 'https' {
  const https: any
  export = https
}

declare module 'stream' {
  const stream: any
  export = stream
}

declare module 'node:stream' {
  const stream: any
  export = stream
}

declare module 'events' {
  const events: any
  export = events
}

declare module 'util' {
  const util: any
  export = util
}

declare module 'zlib' {
  const zlib: any
  export = zlib
}

declare module 'tty' {
  const tty: any
  export = tty
}

declare module 'module' {
  const mod: any
  export = mod
}

declare module 'buffer' {
  const buffer: any
  export = buffer
}

declare module 'worker_threads' {
  const wt: any
  export = wt
}

declare module 'net' {
  const net: any
  export = net
}
