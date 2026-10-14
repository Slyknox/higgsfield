import "server-only"

import { cache } from "react"

import { auth } from "@/auth"

/** The current session, read once per request however many components ask. */
export const getSession = cache(() => auth())
