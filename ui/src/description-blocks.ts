/** Recognize plain-text list markers without executing imported HTML or Markdown. */
export function descriptionBlocks(text: string) {
  const blocks: { kind: 'paragraph' | 'ul' | 'ol'; lines: string[]; start?: number }[] = [];
  let current: (typeof blocks)[number] | undefined;
  for (const line of text.replace(/\r\n?/g, '\n').replace(/[^\S\n]+([•●▪‣])\s+/g, '\n$1 ').split('\n')) {
    if (!line.trim()) {
      current = undefined;
      continue;
    }
    const bullet = line.match(/^\s*(?:[•●▪‣*+-]\s+|([0-9]+)[.)]\s+)(.*)$/);
    const kind = bullet ? bullet[1] ? 'ol' : 'ul' : 'paragraph';
    if (!bullet && current && current.kind !== 'paragraph' && /^\s+/.test(line)) {
      current.lines[current.lines.length - 1] += `\n${line.trim()}`;
      continue;
    }
    if (!current || current.kind !== kind) {
      if (bullet && blocks.at(-1)?.kind === kind) current = blocks.at(-1)!;
      else {
        current = { kind, lines: [], ...(bullet?.[1] ? { start: Number(bullet[1]) } : {}) };
        blocks.push(current);
      }
    }
    current.lines.push(bullet ? bullet[2] : line);
  }
  return blocks;
}
