import * as fs from 'fs';
import * as path from 'path';
import {
  BibleVersion,
  CanonicalBibleContext,
  CanonicalVerse,
  GrammarV2Input,
} from './grammarV2Types';

type BibleSourceErrorCode = 'invalid-argument' | 'not-found';

interface BibleChapterFile {
  book: string;
  bookKo: string;
  chapter: number;
  verses: CanonicalVerse[];
}

export class BibleSourceError extends Error {
  constructor(public readonly code: BibleSourceErrorCode, message: string) {
    super(message);
    this.name = 'BibleSourceError';
  }
}

const SUPPORTED_VERSIONS = new Set<BibleVersion>(['kjv']);
const chapterCache = new Map<string, BibleChapterFile>();

function assertPositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new BibleSourceError('invalid-argument', `${fieldName} must be a positive integer.`);
  }
  return Number(value);
}

function normalizeInput(input: GrammarV2Input): GrammarV2Input {
  const version = input.version;
  const book = String(input.book || '').trim().toLowerCase();
  const chapter = assertPositiveInteger(input.chapter, 'chapter');
  const verse = assertPositiveInteger(input.verse, 'verse');

  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new BibleSourceError('invalid-argument', `Unsupported Bible version: ${version}`);
  }
  if (!/^[a-z]+$/.test(book)) {
    throw new BibleSourceError('invalid-argument', 'book must be a lowercase English prefix.');
  }

  return { version, book, chapter, verse };
}

function bibleDataRoot(): string {
  return path.resolve(__dirname, '../../data/bible');
}

function chapterFilePath(version: BibleVersion, book: string, chapter: number): string {
  return path.join(bibleDataRoot(), version, `${book}_${chapter}.json`);
}

function loadChapter(version: BibleVersion, book: string, chapter: number): BibleChapterFile {
  const cacheKey = `${version}:${book}:${chapter}`;
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  const filePath = chapterFilePath(version, book, chapter);
  if (!fs.existsSync(filePath)) {
    throw new BibleSourceError('not-found', `Bible source file not found: ${version}/${book}_${chapter}.json`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as BibleChapterFile;
  if (!parsed || !Array.isArray(parsed.verses)) {
    throw new BibleSourceError('invalid-argument', `Invalid Bible source structure: ${version}/${book}_${chapter}.json`);
  }

  chapterCache.set(cacheKey, parsed);
  return parsed;
}

export function buildGrammarV2CacheKey(input: GrammarV2Input): string {
  const normalized = normalizeInput(input);
  return `bible_${normalized.version}_${normalized.book}_${normalized.chapter}_${normalized.verse}_grammar-v2`;
}

export function loadCanonicalBibleContext(input: GrammarV2Input): CanonicalBibleContext {
  const normalized = normalizeInput(input);
  const chapterData = loadChapter(normalized.version, normalized.book, normalized.chapter);
  const targetIndex = chapterData.verses.findIndex((item) => item.verse === normalized.verse);

  if (targetIndex === -1) {
    throw new BibleSourceError(
      'not-found',
      `Verse not found: ${normalized.version}/${normalized.book} ${normalized.chapter}:${normalized.verse}`
    );
  }

  return {
    ...normalized,
    bookName: chapterData.book,
    bookNameKo: chapterData.bookKo,
    targetVerse: chapterData.verses[targetIndex],
    contextBefore: targetIndex > 0 ? chapterData.verses[targetIndex - 1] : null,
    contextAfter: targetIndex < chapterData.verses.length - 1 ? chapterData.verses[targetIndex + 1] : null,
  };
}
