export interface Campus {
  id: string
  universityId: string
  nom: string
  adresse?: string
  ville?: string
  createdAt: number
}

export type CampusFormData = Omit<Campus, 'id' | 'universityId' | 'createdAt'>
