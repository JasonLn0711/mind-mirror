type AxisConfig = {
  key: string;
  leftKey: string;
  rightKey: string;
  leftLabel: string;
  rightLabel: string;
};

type ResultProfileRow = {
  profile_key: string;
  title: string;
  summary: string;
  strengths: string[];
  blind_spots: string[];
  growth_suggestions: string[];
};

type TraitWeights = {
  quadrant?: "ll" | "lr" | "rl" | "rr";
  scores?: Record<string, number>;
  tags?: Record<string, number>;
};

function resolveProfileKey(axisScores: Array<{ balance: number; balanced: boolean }>, quadrants: Record<string, number>, answerCount: number) {
  const balancedCount = axisScores.filter((axis) => axis.balanced).length;
  const activeQuadrants = Object.values(quadrants).filter((count) => count > 0).length;
  const topQuadrantShare = Math.max(...Object.values(quadrants)) / Math.max(answerCount, 1);
  const tensionHigh = activeQuadrants >= 3 || topQuadrantShare < 0.45;

  if (balancedCount === 2) {
    return tensionHigh ? "tension_mirror" : "balanced_integration";
  }

  if (balancedCount === 1) {
    return tensionHigh ? "tension_pivot" : "balanced_bridge";
  }

  return `quadrant_${axisScores[0].balance <= 0 ? "l" : "r"}${axisScores[1].balance <= 0 ? "l" : "r"}`;
}

export function computeResultFromSelections(args: {
  axisConfig: { axes: AxisConfig[] };
  tagLabels: Record<string, string>;
  resultProfiles: ResultProfileRow[];
  selectedOptions: TraitWeights[];
}) {
  const traitScores: Record<string, number> = {};
  const tagScores: Record<string, number> = {};
  const quadrants = { ll: 0, lr: 0, rl: 0, rr: 0 };

  args.selectedOptions.forEach((option) => {
    Object.entries(option.scores || {}).forEach(([key, value]) => {
      traitScores[key] = (traitScores[key] || 0) + value;
    });

    Object.entries(option.tags || {}).forEach(([key, value]) => {
      tagScores[key] = (tagScores[key] || 0) + value;
    });

    if (option.quadrant && quadrants[option.quadrant] !== undefined) {
      quadrants[option.quadrant] += 1;
    }
  });

  const axisScores = args.axisConfig.axes.map((axis) => {
    const leftScore = traitScores[axis.leftKey] || 0;
    const rightScore = traitScores[axis.rightKey] || 0;
    const total = Math.max(1, leftScore + rightScore);
    const balance = (rightScore - leftScore) / total;
    const intensity = Math.abs(balance);
    const balanced = intensity <= 0.18;

    return {
      key: axis.key,
      leftKey: axis.leftKey,
      rightKey: axis.rightKey,
      leftLabel: axis.leftLabel,
      rightLabel: axis.rightLabel,
      leftScore,
      rightScore,
      balance,
      intensity,
      balanced,
      dominantKey: balanced ? "balanced" : balance > 0 ? axis.rightKey : axis.leftKey,
      dominantLabel: balanced ? "平衡中" : balance > 0 ? axis.rightLabel : axis.leftLabel,
    };
  });

  const profileKey = resolveProfileKey(axisScores, quadrants, args.selectedOptions.length);
  const profile = args.resultProfiles.find((entry) => entry.profile_key === profileKey);

  if (!profile) {
    throw new Error(`Result profile ${profileKey} is missing.`);
  }

  const topTags = Object.entries(tagScores)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([key, score]) => ({
      key,
      label: args.tagLabels[key] || key,
      score,
    }));

  return {
    profileKey,
    profile,
    traitScores,
    axisScores,
    topTags,
  };
}
