export interface SentenceRect {
  text: string;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface SentenceLayout {
  text: string;
  rects: SentenceRect[];
}

export interface ParagraphLayout {
  sentences: SentenceLayout[];
  zoom: number;
}

export interface SectionLayout {
  paragraphs: ParagraphLayout[];
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}
