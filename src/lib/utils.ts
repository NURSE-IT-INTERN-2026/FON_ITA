import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Client-side mirror of the MB limit the server enforces in bytes. */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}
