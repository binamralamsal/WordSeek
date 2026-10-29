import { InputFile } from "grammy";

import sharp from "sharp";
import { join } from "path";
import satori from "satori";
import { readFile } from "fs/promises";

import { evaluateGuess } from "./board.helper";
import type { GuessEntry, LetterState } from "../types";

const TILE_SIZE = 60;
const GAP = 8;
const PADDING = 20;
const VISIBLE_ROWS = 6;

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
  const width = PADDING * 2 + columnWidth;
  const height =
    PADDING * 2 + VISIBLE_ROWS * TILE_SIZE + (VISIBLE_ROWS - 1) * GAP;

  // Pad with empty rows if less than 6 guesses
  const paddedTiles: {
    guess: string;
    result: (LetterState | "empty")[];
  }[] = [...tiles];
  while (paddedTiles.length < VISIBLE_ROWS) {
    paddedTiles.push({
      guess: "     ",
      result: Array(5).fill("empty"),
    });
  }

  const svg = await satori(
    <div
      style={{
        display: "flex",
        background: "#121213",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {paddedTiles.map(({ guess, result }, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: "8px" }}>
            {guess.split("").map((letter, i) => {
              const state = result[i];
              const isEmpty = state === "empty";
              const background = isEmpty
                ? "#3a3a3c"
                : TILE_COLORS[state as LetterState];

              return (
                <div
                  key={i}
                  style={{
                    width: "60px",
                    height: "60px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background,
                    color: isEmpty ? "#3a3a3c" : "white",
                    fontSize: "32px",
                    fontWeight: "bold",
                    border: isEmpty ? "2px solid #565758" : "none",
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
