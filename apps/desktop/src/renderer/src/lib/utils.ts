import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.api.invoke(channel as never, ...args) as Promise<T>
}
