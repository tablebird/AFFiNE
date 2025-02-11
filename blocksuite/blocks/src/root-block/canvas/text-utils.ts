import type { SentenceRect } from './types';

export function segmentSentences(text: string): string[] {
  // Simple sentence segmentation by punctuation
  return text
    .split(/([.!?]+\s+)/)
    .filter(Boolean)
    .map(s => s.trim())
    .filter(Boolean);
}

export function getSentenceRects(
  element: Element,
  sentence: string
): SentenceRect[] {
  const range = document.createRange();
  const textNode = Array.from(element.childNodes).find(
    node => node.nodeType === Node.TEXT_NODE
  );

  if (!textNode) return [];

  const text = textNode.textContent || '';
  const startIndex = text.indexOf(sentence);
  if (startIndex === -1) return [];

  range.setStart(textNode, startIndex);
  range.setEnd(textNode, startIndex + sentence.length);

  const rects = Array.from(range.getClientRects());
  return rects.map(rect => ({
    text: sentence,
    rect: {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    },
  }));
}
