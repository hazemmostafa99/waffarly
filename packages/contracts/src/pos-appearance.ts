export const POS_APPEARANCE_ACCENTS = ['orange', 'plum', 'teal', 'blue'] as const;
export type PosAppearanceAccent = (typeof POS_APPEARANCE_ACCENTS)[number];

export interface PosAppearanceSummary {
  accent: PosAppearanceAccent;
  revision: number;
  updatedAt: string;
}

export interface UpdatePosAppearanceRequest {
  accent: PosAppearanceAccent;
  revision: number;
}
