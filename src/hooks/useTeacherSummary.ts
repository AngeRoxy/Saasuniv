'use client'

import { useState, useEffect } from 'react'
import {
  getFilieres,
  getSemestres,
  getCreneaux,
  getNotes,
  getAbsences,
  getUniversityMembers,
} from '@/lib/db'
import type { Creneau } from '@/types/emploi-du-temps'
import { trouverProchainCours } from '@/hooks/useStudentSummary'

export interface TeacherSummary {
  /** Nombre de classes distinctes (filière + niveau) assignées ce semestre. */
  classes: number
  /** Nombre de matières distinctes enseignées ce semestre. */
  matieres: number
  /** Absences injustifiées sur les matières de l'enseignant (à justifier/traiter). */
  absencesATraiter: number
  /** Prochain cours de l'enseignant dans la semaine type. */
  prochainCours: Creneau | null
  /** Notes manquantes : (étudiant × matière) sans note saisie dans ses classes. */
  notesEnAttente: number
  /** Nombre d'étudiants couverts par ses classes (dénominateur de notesEnAttente). */
  etudiantsConcernes: number
  loading: boolean
}

const EMPTY: TeacherSummary = {
  classes: 0,
  matieres: 0,
  absencesATraiter: 0,
  prochainCours: null,
  notesEnAttente: 0,
  etudiantsConcernes: 0,
  loading: true,
}

/**
 * Synthèse de l'enseignant connecté.
 *
 * L'affectation enseignant ↔ cours se fait par NOM dans les créneaux
 * (`creneau.enseignant === displayName`) — c'est la convention déjà en place
 * dans /teacher/schedule et /teacher/cours-en-ligne, on ne l'invente pas ici.
 * Un enseignant dont le nom ne correspond à aucun créneau voit simplement des
 * compteurs à zéro, ce qui est la vérité.
 */
export function useTeacherSummary(
  universityId: string | undefined,
  teacherName: string
): TeacherSummary {
  const [summary, setSummary] = useState<TeacherSummary>(EMPTY)

  // Pas de setState synchrone dans l'effet (react-hooks/set-state-in-effect,
  // erreur bloquante en React 19 / Next 16) : l'état vide est dérivé au retour.
  useEffect(() => {
    if (!universityId || !teacherName) return
    let active = true
    ;(async () => {
      try {
        const [filieres, semestres, creneaux, notes, absences, etudiants] = await Promise.all([
          getFilieres(universityId),
          getSemestres(universityId),
          getCreneaux(universityId),
          getNotes(universityId),
          getAbsences(universityId),
          getUniversityMembers(universityId, 'student'),
        ])
        if (!active) return

        const semestreCourant = semestres.find((s) => s.statut === 'en_cours') ?? semestres[0]
        const semestreId = semestreCourant?.id ?? ''

        const mesCreneaux = creneaux.filter(
          (c) => c.enseignant === teacherName && (!semestreId || c.semestreId === semestreId)
        )

        const classes = new Set(mesCreneaux.map((c) => `${c.filiereId}__${c.niveau}`))
        const mesMatieres = new Set(mesCreneaux.map((c) => c.matiere))

        // Absences à traiter : injustifiées, sur une matière que l'enseignant assure.
        const absencesATraiter = absences.filter(
          (a) => !a.justifiee && a.matiere && mesMatieres.has(a.matiere)
        ).length

        // Notes en attente : pour chaque couple (matière, classe) qu'il enseigne,
        // les étudiants de cette classe qui n'ont pas encore de note ce semestre.
        // Les créneaux ne portent que le NOM de la matière : on rapproche les
        // notes par nom + filière + niveau (mêmes clés que la saisie).
        const filiereNomById = new Map(filieres.map((f) => [f.id, f.nom]))
        const couples = new Map<string, { matiere: string; filiereId: string; niveau: string }>()
        for (const c of mesCreneaux) {
          couples.set(`${c.matiere}__${c.filiereId}__${c.niveau}`, {
            matiere: c.matiere,
            filiereId: c.filiereId,
            niveau: c.niveau,
          })
        }

        let notesEnAttente = 0
        const etudiantsCouverts = new Set<string>()

        for (const { matiere, filiereId, niveau } of couples.values()) {
          const filiereNom = filiereNomById.get(filiereId)
          if (!filiereNom) continue

          const eleves = etudiants.filter(
            (e) => e.filiere === filiereNom && e.niveau === niveau
          )
          eleves.forEach((e) => etudiantsCouverts.add(e.uid))

          const notesSaisies = new Set(
            notes
              .filter(
                (n) =>
                  n.matiere === matiere &&
                  n.filiereId === filiereId &&
                  n.niveau === niveau &&
                  (!semestreId || n.semestreId === semestreId)
              )
              .map((n) => n.studentUid)
          )

          notesEnAttente += eleves.filter((e) => !notesSaisies.has(e.uid)).length
        }

        setSummary({
          classes: classes.size,
          matieres: mesMatieres.size,
          absencesATraiter,
          prochainCours: trouverProchainCours(mesCreneaux, new Date()),
          notesEnAttente,
          etudiantsConcernes: etudiantsCouverts.size,
          loading: false,
        })
      } catch (err) {
        console.error('useTeacherSummary : chargement échoué', err)
        if (active) setSummary({ ...EMPTY, loading: false })
      }
    })()
    return () => {
      active = false
    }
  }, [universityId, teacherName])

  if (!universityId || !teacherName) return { ...EMPTY, loading: false }
  return summary
}
