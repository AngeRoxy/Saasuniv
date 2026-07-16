'use client'

import { useState, useEffect } from 'react'
import {
  getUniversityMember,
  getFilieres,
  getSemestres,
  getCreneaux,
  getNotesForStudent,
  getAbsencesForStudent,
  getPaiementsForStudent,
  getMoyennesManuelles,
  getSeuilAlerteConfig,
} from '@/lib/db'
import { getNoteRetenue } from '@/types/note'
import { statutAffiche } from '@/types/paiement'
import { trouverProchainCours, type Creneau } from '@/types/emploi-du-temps'

// Réexport : `trouverProchainCours` vit désormais dans types/emploi-du-temps.ts
// (fonction pure, partagée avec le contexte serveur du chatbot). Les importeurs
// existants (useTeacherSummary) continuent de la trouver ici.
export { trouverProchainCours }

export interface StudentSummary {
  /** Moyenne du semestre en cours, ou null si aucune note publiée. */
  moyenne: number | null
  /** True si la moyenne affichée a été forcée par un enseignant. */
  moyenneForcee: boolean
  nbNotes: number
  absencesTotal: number
  absencesInjustifiees: number
  /** Seuil configuré par l'université — au-delà, l'affichage passe en alerte. */
  seuilAbsences: number
  /** Prochain cours à venir dans la semaine type, ou null. */
  prochainCours: Creneau | null
  /** Somme des échéances non payées (FCFA). */
  soldeDu: number
  /** Nombre d'échéances dépassées et non payées. */
  paiementsEnRetard: number
  /** Filière/niveau non renseignés → l'emploi du temps ne peut pas être résolu. */
  scolariteIncomplete: boolean
  loading: boolean
}

const EMPTY: StudentSummary = {
  moyenne: null,
  moyenneForcee: false,
  nbNotes: 0,
  absencesTotal: 0,
  absencesInjustifiees: 0,
  seuilAbsences: 0,
  prochainCours: null,
  soldeDu: 0,
  paiementsEnRetard: 0,
  scolariteIncomplete: false,
  loading: true,
}

/** 'YYYY-MM-DD' du jour, pour dériver le statut « En retard » d'un paiement. */
function todayISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Synthèse scolaire d'UN étudiant : moyenne, absences, prochain cours, solde.
 * Toutes les données proviennent des mêmes fonctions `db.ts` que les pages
 * détaillées (notes, absences, paiements, emploi du temps) — aucun chiffre n'est
 * recalculé différemment ici, et aucune valeur n'est inventée.
 *
 * Réutilisé tel quel par le parent, en passant l'uid de l'enfant sélectionné.
 */
export function useStudentSummary(
  universityId: string | undefined,
  studentUid: string | undefined
): StudentSummary {
  const [summary, setSummary] = useState<StudentSummary>(EMPTY)

  // Sans identifiants il n'y a rien à charger : on sort SANS setState. Appeler
  // setState de façon synchrone dans un effet est une erreur en React 19 /
  // Next 16 (react-hooks/set-state-in-effect) — l'état vide est donc dérivé au
  // retour du hook, pas poussé dans le state.
  useEffect(() => {
    if (!universityId || !studentUid) return
    let active = true
    ;(async () => {
      try {
        const [member, filieres, semestres, creneaux, notes, absences, paiements, seuil] =
          await Promise.all([
            getUniversityMember(universityId, studentUid),
            getFilieres(universityId),
            getSemestres(universityId),
            getCreneaux(universityId),
            getNotesForStudent(universityId, studentUid),
            getAbsencesForStudent(universityId, studentUid),
            getPaiementsForStudent(universityId, studentUid),
            getSeuilAlerteConfig(universityId),
          ])
        if (!active) return

        // Semestre de référence : celui en cours, sinon le premier déclaré.
        const semestreCourant = semestres.find((s) => s.statut === 'en_cours') ?? semestres[0]
        const semestreId = semestreCourant?.id ?? ''

        // Moyenne : même règle que GradeView — moyenne forcée si elle existe,
        // sinon moyenne des notes RETENUES (rattrapage prioritaire) du semestre.
        const notesSemestre = semestreId
          ? notes.filter((n) => n.semestreId === semestreId)
          : notes
        const moyenneAuto =
          notesSemestre.length > 0
            ? notesSemestre.reduce((a, n) => a + getNoteRetenue(n), 0) / notesSemestre.length
            : null

        let moyenneManuelle: number | null = null
        if (semestreId) {
          const map = await getMoyennesManuelles(universityId, semestreId)
          if (!active) return
          moyenneManuelle = map[studentUid] ?? null
        }

        // Emploi du temps : résolu via filière (par nom) + niveau du membre.
        const filiere = member?.filiere
          ? filieres.find((f) => f.nom === member.filiere)
          : undefined
        const niveau = member?.niveau
        const mesCreneaux =
          filiere && niveau
            ? creneaux.filter(
                (c) =>
                  c.filiereId === filiere.id &&
                  c.niveau === niveau &&
                  (!semestreId || c.semestreId === semestreId)
              )
            : []

        const now = new Date()
        const today = todayISO(now)
        const impayes = paiements.filter((p) => p.statut !== 'Payé')

        setSummary({
          moyenne: moyenneManuelle ?? moyenneAuto,
          moyenneForcee: moyenneManuelle !== null,
          nbNotes: notesSemestre.length,
          absencesTotal: absences.length,
          absencesInjustifiees: absences.filter((a) => !a.justifiee).length,
          seuilAbsences: seuil,
          prochainCours: trouverProchainCours(mesCreneaux, now),
          soldeDu: impayes.reduce((a, p) => a + p.montant, 0),
          paiementsEnRetard: paiements.filter((p) => statutAffiche(p, today) === 'En retard').length,
          scolariteIncomplete: !filiere || !niveau,
          loading: false,
        })
      } catch (err) {
        console.error('useStudentSummary : chargement échoué', err)
        if (active) setSummary({ ...EMPTY, loading: false })
      }
    })()
    return () => {
      active = false
    }
  }, [universityId, studentUid])

  if (!universityId || !studentUid) return { ...EMPTY, loading: false }
  return summary
}
