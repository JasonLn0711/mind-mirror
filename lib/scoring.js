export function shuffleArray(list) {
  const clone = [...list];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
  }
  return clone;
}

export function pickRandomQuestions(topic, count) {
  return shuffleArray(topic.questions).slice(0, count);
}

function aggregateTraitScores(selectedOptions) {
  const scores = {};
  const tags = {};
  const quadrants = {
    ll: 0,
    lr: 0,
    rl: 0,
    rr: 0,
  };

  selectedOptions.forEach((option) => {
    const payload = option.traitWeights || {};
    const numericScores = payload.scores || {};
    const numericTags = payload.tags || {};

    Object.entries(numericScores).forEach(([key, value]) => {
      scores[key] = (scores[key] || 0) + value;
    });

    Object.entries(numericTags).forEach(([key, value]) => {
      tags[key] = (tags[key] || 0) + value;
    });

    if (payload.quadrant && quadrants[payload.quadrant] !== undefined) {
      quadrants[payload.quadrant] += 1;
    }
  });

  return {
    scores,
    tags,
    quadrants,
  };
}

function buildAxisScores(topic, traitScores) {
  return topic.axes.map((axis) => {
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
      total,
      balance,
      intensity,
      balanced,
      dominantKey: balanced ? "balanced" : balance > 0 ? axis.rightKey : axis.leftKey,
      dominantLabel: balanced ? "平衡中" : balance > 0 ? axis.rightLabel : axis.leftLabel,
    };
  });
}

function resolveProfileKey(axisScores, quadrants, answerCount) {
  const [firstAxis, secondAxis] = axisScores;
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

  return `quadrant_${firstAxis.balance <= 0 ? "l" : "r"}${secondAxis.balance <= 0 ? "l" : "r"}`;
}

function topTagEntries(topic, tagScores, limit = 4) {
  return Object.entries(tagScores)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: topic.tagLabels[key] || key,
      score: value,
    }));
}

export function computeQuizResult(topic, selectedOptions) {
  const { scores, tags, quadrants } = aggregateTraitScores(selectedOptions);
  const axisScores = buildAxisScores(topic, scores);
  const profileKey = resolveProfileKey(axisScores, quadrants, selectedOptions.length);
  const profile = topic.resultProfiles.find((entry) => entry.profileKey === profileKey);

  return {
    profileKey,
    profile,
    traitScores: scores,
    axisScores,
    tagScores: tags,
    topTags: topTagEntries(topic, tags),
    quadrantCounts: quadrants,
  };
}
