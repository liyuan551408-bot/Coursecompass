/** Keep placeholder comments out of generated claims and summarize ratings when no written evidence remains. */
const buildReviewSummaryEvidence = reviews => {
    const comments = reviews
        .map(review => typeof review.comment === 'string' ? review.comment.trim() : '')
        .filter(comment => comment && !/^(?:test(?:ing)?|test review|[\d\W]+|very)$/i.test(comment))
        .map(comment => comment.slice(0, 1000));
    const average = field => {
        const values = reviews.map(review => review[field]).filter(Number.isFinite);
        return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}/5` : 'not available';
    };
    return {
        comments,
        ratingsOnlySummary: `Based on ${reviews.length} approved review(s). Overall recommendation: ${average('overallRating')}.\n\nPros: Written evidence is insufficient to identify specific strengths.\n\nCons: Written evidence is insufficient to identify specific concerns.\n\nWorkload & Difficulty: Workload rating ${average('workloadRating')}; difficulty rating ${average('difficultyRating')}. These ratings do not establish assessment formats or specific workload details.`
    };
};

module.exports = { buildReviewSummaryEvidence };
