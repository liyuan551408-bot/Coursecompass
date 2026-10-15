export const INTEREST_KEYWORDS = Object.freeze([
  'Artificial Intelligence', 'Machine Learning', 'Software Engineering', 'Web Development',
  'Mobile Development', 'Data Science', 'Cybersecurity', 'Algorithms', 'Databases',
  'Cloud Computing', 'UX/UI', 'Game Development', 'Networking',
])

export const GOAL_KEYWORDS = Object.freeze([
  'Build programming foundations', 'Prepare for software engineering jobs', 'Learn AI development',
  'Improve data analysis skills', 'Prepare for postgraduate study', 'Explore cybersecurity',
  'Improve software development skills', 'Learn cloud technologies',
])

const ALIASES = {
  ai: ['artificial intelligence', 'machine learning', 'ai development'],
  machine: ['machine learning', 'artificial intelligence'],
  programming: ['programming foundations', 'software development', 'software engineering'],
  coding: ['programming foundations', 'software development', 'software engineering'],
  data: ['data science', 'data analysis', 'databases'],
  security: ['cybersecurity'],
  cyber: ['cybersecurity'],
  cloud: ['cloud computing', 'cloud technologies'],
  web: ['web development', 'ux/ui'],
  postgraduate: ['postgraduate study'],
  jobs: ['software engineering jobs'],
}

const normalize = value => String(value || '').trim().toLowerCase()

export function dedupeKeywords(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).filter((value) => {
    const key = normalize(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function suggestKeywords(input, vocabulary, selected = []) {
  const query = normalize(input)
  const selectedKeys = new Set(dedupeKeywords(selected).map(normalize))
  const queryTokens = query.split(/[^a-z0-9]+/).filter(Boolean)
  const related = new Set(queryTokens.flatMap(token => ALIASES[token] || []))

  return vocabulary
    .filter(item => !selectedKeys.has(normalize(item)))
    .map((item, index) => {
      const text = normalize(item)
      let score = query ? 0 : Math.max(1, vocabulary.length - index)
      if (query && text === query) score += 100
      if (query && text.startsWith(query)) score += 60
      if (query && text.includes(query)) score += 40
      score += queryTokens.filter(token => text.includes(token)).length * 15
      score += [...related].filter(term => text.includes(term)).length * 20
      return { item, score, index }
    })
    .filter(result => !query || result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .map(result => result.item)
}
