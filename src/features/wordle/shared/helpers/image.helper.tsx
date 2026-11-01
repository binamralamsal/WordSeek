import { InputFile } from "grammy";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";

import type { GuessEntry, LetterState } from "../types";
import { evaluateGuess } from "./board.helper";

const TILE_SIZE = 60;
const GAP = 8;
const PADDING = 24;
const TILE_RADIUS = 8;
const VISIBLE_ROWS = 6;

const BACKGROUND = "#121213";
const EMPTY_TILE = "#1c1c1e";
const EMPTY_BORDER = "#3a3a3c";

const TILE_COLORS: Record<LetterState, string> = {
  correct: "#538d4e",
  present: "#b59f3b",
  absent: "#3a3a3c",
};

export async function generateWordleImage(
  data: GuessEntry[],
  solution: string,
) {
  const tiles = data.map((entry) => ({
    guess: entry.guess.toUpperCase(),
    result: evaluateGuess(entry.guess, solution),
  }));

  const fontPath = join(process.cwd(), "src", "fonts", "roboto.ttf");
  const fontData = await readFile(fontPath);

  const columnWidth = solution.length * TILE_SIZE + (solution.length - 1) * GAP;
  const boardHeight = VISIBLE_ROWS * TILE_SIZE + (VISIBLE_ROWS - 1) * GAP;
  const width = PADDING * 2 + columnWidth;
  const height = PADDING * 2 + boardHeight;

  // Pad with empty rows if less than 6 guesses. Match the solution length so
  // the empty grid never overflows the canvas.
  const paddedTiles: {
    guess: string;
    result: (LetterState | "empty")[];
  }[] = [...tiles];
  while (paddedTiles.length < VISIBLE_ROWS) {
    paddedTiles.push({
      guess: " ".repeat(solution.length),
      result: Array.from({ length: solution.length }, () => "empty" as const),
    });
  }

  const svg = await satori(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BACKGROUND,
        padding: `${PADDING}px`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${GAP}px`,
        }}
      >
        {paddedTiles.map(({ guess, result }, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: `${GAP}px` }}>
            {guess.split("").map((letter, i) => {
              const state = result[i];
              const isEmpty = state === "empty";
              const background = isEmpty
                ? EMPTY_TILE
                : TILE_COLORS[state as LetterState];

              return (
                <div
                  key={i}
                  style={{
                    width: `${TILE_SIZE}px`,
                    height: `${TILE_SIZE}px`,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background,
                    color: isEmpty ? EMPTY_TILE : "white",
                    fontSize: "32px",
                    fontWeight: "bold",
                    borderRadius: `${TILE_RADIUS}px`,
                    border: `2px solid ${isEmpty ? EMPTY_BORDER : "transparent"}`,
                  }}
                >
                  {letter.trim()}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        {
          name: "Roboto",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

export function wordleImageFile(imageBuffer: Buffer) {
  return new InputFile(new Uint8Array(imageBuffer));
}
