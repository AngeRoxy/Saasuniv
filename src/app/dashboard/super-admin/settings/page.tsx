'use client'

import { Settings } from 'lucide-react'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function SuperAdminSettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Paramètres de la plateforme"
      description="La configuration globale (plateforme, tarification, notifications, sécurité) sera connectée à la base de données prochainement. Aucune donnée fictive n'est affichée."
    />
  )
}
