import { gemini } from "./gemini.js";

const stream = await gemini.models.generateContentStream({
    model: "gemini-3.8-flash",
    contents: "Explain Server-Sent Events in two short sentences"
});

for await (const chunk of stream){
    process.stdout.write(chunk.text ?? "");

    const finishReason = chunk.candidates?.[0]?.finishReason;

    if (finishReason) {
    console.log("\nFinish reason:", finishReason);
    }
}

console.log();
