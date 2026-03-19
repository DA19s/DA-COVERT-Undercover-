import { supabase } from "@/lib/supabase-client";

export type WordPair = {
  civil_word: string;
  undercover_word: string;
};

type WordsCachePayload = {
  fetchedAt: number;
  items: WordPair[];
};

const WORDS_CACHE_KEY = "dacovert_words_cache_v1";
const WORDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const isWordPair = (value: unknown): value is WordPair => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.civil_word === "string" && typeof row.undercover_word === "string";
};

const readCache = (): WordPair[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WORDS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WordsCachePayload>;
    if (!Array.isArray(parsed.items) || typeof parsed.fetchedAt !== "number") return null;
    if (Date.now() - parsed.fetchedAt > WORDS_CACHE_TTL_MS) return null;
    const valid = parsed.items.filter(isWordPair);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
};

const writeCache = (items: WordPair[]) => {
  if (typeof window === "undefined") return;
  try {
    const payload: WordsCachePayload = { fetchedAt: Date.now(), items };
    localStorage.setItem(WORDS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache errors
  }
};

export const getWordsWithCache = async (): Promise<WordPair[]> => {
  const cached = readCache();
  if (cached && cached.length > 0) return cached;

  const { data, error } = await supabase
    .from("words")
    .select("civil_word, undercover_word");

  if (error) throw error;
  const items = (data ?? []).filter(isWordPair);
  if (items.length === 0) {
    throw new Error("La table 'words' est vide ou introuvable");
  }
  writeCache(items);
  return items;
};

