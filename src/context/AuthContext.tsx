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
    // Garde anti-course : chaque événement d'auth reçoit un numéro de séquence.
    // Si un getUserProfile lent se résout APRÈS un événement plus récent
    // (ex. logout→login rapide dans le même onglet), on l'ignore — sinon le
    // profil d'un compte précédent pourrait écraser celui du compte courant.
    let latestRequest = 0

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const requestId = ++latestRequest
      setUser(firebaseUser)

      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid)
        if (requestId !== latestRequest) return
        setProfile(userProfile)
      } else {
        if (requestId !== latestRequest) return
        setProfile(null)
      }

      if (requestId === latestRequest) setLoading(false)
    })

    return () => {
      latestRequest = Infinity
      unsubscribe()
    }
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
