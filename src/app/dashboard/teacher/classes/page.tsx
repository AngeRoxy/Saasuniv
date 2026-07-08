'use client'

import { Users } from 'lucide-react'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function TeacherClassesPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Mes classes"
      description="Vos classes et leurs étudiants s'afficheront ici dès que le module sera connecté à la base de données. Aucune donnée fictive n'est affichée."
    />
  )
}
