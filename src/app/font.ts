import fs from 'fs';
import path from 'path';
import { cwd } from 'process';

const FONT_IBM_PLEX_MONO_FAMILY = 'IBMPlexMono';
const FONT_IBM_PLEX_MONO_PATH = '/public/fonts/IBMPlexMono-Medium.ttf';

// Local CJK (Simplified Chinese) subset used as a fallback so that
// next/og (satori) can render Chinese tags / album names / locations
// WITHOUT fetching dynamic fonts from Google at build/runtime
// (which times out from CN servers → ETIMEDOUT).
const FONT_NOTO_SANS_SC_FAMILY = 'NotoSansSC';
const FONT_NOTO_SANS_SC_PATH = '/public/fonts/NotoSansSC-Medium-Subset.ttf';

const readFont = (relativePath: string) =>
  fs.readFileSync(path.join(cwd(), relativePath));

const getFontData = async () => readFont(FONT_IBM_PLEX_MONO_PATH);

const getNotoSansSCData = async () => {
  try {
    return readFont(FONT_NOTO_SANS_SC_PATH);
  } catch {
    // Font file missing → silently skip CJK fallback
    return undefined;
  }
};

export const getIBMPlexMono = async () => {
  const [latinData, cjkData] = await Promise.all([
    getFontData(),
    getNotoSansSCData(),
  ]);

  const fonts = [
    {
      name: FONT_IBM_PLEX_MONO_FAMILY,
      data: latinData,
      weight: 500,
      style: 'normal',
    } as const,
    // CJK fallback: satori falls back across all provided fonts when
    // the primary family lacks a glyph for a given character.
    ...(cjkData
      ? [{
        name: FONT_NOTO_SANS_SC_FAMILY,
        data: cjkData,
        weight: 500,
        style: 'normal',
      } as const]
      : []),
  ];

  return {
    // Primary family used by the OG components; CJK glyphs are picked
    // up automatically via satori's font fallback.
    fontFamily: FONT_IBM_PLEX_MONO_FAMILY,
    fonts,
  };
};
