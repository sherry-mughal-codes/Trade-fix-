import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text", placeholder: "Enter email or username" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier || "").trim().toLowerCase()
        if (!identifier || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findFirst({
          where: identifier.includes("@") ? { email: identifier } : { username: identifier },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        })

        if (!user) {
          return null
        }

        if (!user.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          isSuperadmin: user.isSuperadmin,
          roles: user.roles.map((ur) => ({ id: ur.roleId, name: ur.role.name }))
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = typeof token.email === "string" ? token.email : null
        session.user.username = typeof (token as any).username === "string" ? (token as any).username : null
        session.user.isSuperadmin = Boolean((token as any).isSuperadmin)
        session.user.roles = Array.isArray((token as any).roles) ? ((token as any).roles as any) : []
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = (user as any).email ?? null
        ;(token as any).username = (user as any).username ?? null
        ;(token as any).isSuperadmin = Boolean((user as any).isSuperadmin)
        ;(token as any).roles = (user as any).roles || []
      }
      return token
    }
  }
}
