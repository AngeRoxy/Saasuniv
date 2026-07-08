'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, onIdTokenChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile, type UserProfile } from '@/lib/db'
import { syncSessionCookie, clearSessionCookie } from '@/lib/session-client'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Synchronise le cookie de session httpOnly lu par le proxy (src/proxy.ts).
  // onIdTokenChanged couvre connexion, inscription, renouvellement de token et
  // déconnexion → le cookie reste frais tant que l'application est ouverte.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        void syncSessionCookie()
      } else {
        void clearSessionCookie()
      }
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
