'use client'
// components/providers/SessionProvider.jsx
// Wrapper de cliente para el SessionProvider de NextAuth

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export default function SessionProvider({ children, session }) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}
