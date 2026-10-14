import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username?: string | null
      isSuperadmin: boolean
      roles: { id: string; name: string }[]
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email?: string | null
    username?: string | null
    isSuperadmin: boolean
    roles: { id: string; name: string }[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username?: string | null
    isSuperadmin: boolean
    roles: { id: string; name: string }[]
  }
}
