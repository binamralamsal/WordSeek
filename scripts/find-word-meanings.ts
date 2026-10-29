import { promises as fs } from "fs";

// Input JSON file
const inputFilePath = "words.json";
const outputFilePath = "words_with_details.json";

async function fetchWordDetails(word: string) {
  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Word not found: ${word}`);
    }
    const data = await response.json();
    const meanings =
      data[0]?.meanings
        .map((meaning: any) => meaning.definitions[0]?.definition)
        .join("; ") || "";
    const pronunciation = data[0]?.phonetics[0]?.text || "";
    const example = data[0]?.meanings[0]?.definitions[0]?.example || "";

    return {
      meaning: meanings,
      pronunciation: pronunciation,
      example: example,
    };
  } catch (error) {
    console.error(`Error fetching details for ${word}:`, error.message);
    return {
      meaning: "",
      pronunciation: "",
      example: "",
    };
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWords() {
  try {
    const words = JSON.parse(await fs.readFile(inputFilePath, "utf-8"));
    let result = {};

    try {
      result = JSON.parse(await fs.readFile(outputFilePath, "utf-8"));
    } catch {}

    for (const word of words) {
      if (!result[word]) {
        console.log(`Fetching details for: ${word}`);
        result[word] = await fetchWordDetails(word);
        await fs.writeFile(
          outputFilePath,
          JSON.stringify(result, null, 2),
          "utf-8",
        );
        await delay(1000); // Delay to avoid rate limiting
      } else {
        console.log(`Details already exist for: ${word}`);
      }
    }

    console.log("Processing complete.");
  } catch (error) {
    console.error("Error during processing:", error);
  }
}

processWords();
