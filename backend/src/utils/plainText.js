const toPlainText = (value) => {
    if (typeof value !== 'string') return '';

    return value
        .replace(/\r\n?/g, '\n')
        .replace(/```(?:[a-z0-9_-]+)?\s*\n?/gi, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
        .replace(/^\s*[-*_]{3,}\s*$/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, '')
        .replace(/\s*\|\s*/g, '  ')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

module.exports = { toPlainText };
