export type IdeaStage = 'intake' | 'research' | 'problem' | 'concept' | 'decision';

export const IDEA_STAGES: readonly IdeaStage[] = ['intake', 'research', 'problem', 'concept', 'decision'];

export const IDEA_VERDICTS = ['go', 'needs-clarification', 'kill'] as const;

export type IdeaVerdict = typeof IDEA_VERDICTS[number];

export const IDEA_RATINGS = ['strong', 'adequate', 'weak', 'unknown'] as const;

export type IdeaRating = typeof IDEA_RATINGS[number];

export type IdeaTone = 'favourable' | 'mixed' | 'unfavourable';

export const IDEA_RATING_TONES: Readonly<Record<IdeaRating, IdeaTone | undefined>> = {
    strong: 'favourable',
    adequate: 'mixed',
    weak: 'unfavourable',
    unknown: undefined,
};
