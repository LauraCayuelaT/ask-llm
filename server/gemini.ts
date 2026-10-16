import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if(!apiKey){
    throw new Error("Gemini API Key is required");
}

export const gemini = new GoogleGenAI({ apiKey });