import { expect, test, vi } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { gemini } from "./gemini.js";
import { GenerateContentResponse } from "@google/genai";

vi.mock("./gemini.js", ()=>({
    gemini:{
        models:{
            generateContentStream: vi.fn()
        }
    }
}));

async function* createFakeStream(texts: string[]){
    for(const text of texts){
        const chunk = new GenerateContentResponse();

        chunk.candidates = [
            {
                content: {
                    role: "model",
                    parts: [{text}]
                }
            }
        ];

        yield chunk;
    }
};

test.each([
    {question: 123},
    {question: ""},
    {question: "  "},
    {question: null},
    {}
])("rejects invalid input %j without calling Gemini", async(body)=>{
    const response = await request(app)
        .post("/api/ask")
        .send(body);
    
    expect(response.status).toBe(400);

    expect(response.body).toEqual({
        error: "Question must be a non-empty string"
    });

    expect(gemini.models.generateContentStream).not.toHaveBeenCalled();
});

test("returns 502 when Gemini fails before streaming", async()=>{
    vi.clearAllMocks();

    vi.mocked(gemini.models.generateContentStream)
        .mockRejectedValueOnce(new Error("Provider unavailable"));

    const response = await request(app)
        .post("/api/ask")
        .send({question: "What is the remote work policy?"});

    expect(response.status).toBe(502);

    expect(response.body).toEqual({
        error: "Unable to generate an answer"
    });

    expect(gemini.models.generateContentStream).toHaveBeenCalledTimes(1);
});

test("streams chunks, cited sources and a final done event", async () => {
  vi.clearAllMocks();

  const stream = createFakeStream([
    "Employees may work remotely ",
    "up to three days per week [demo-001]."
  ]);

  vi.mocked(gemini.models.generateContentStream)
    .mockResolvedValueOnce(stream);

  const response = await request(app)
    .post("/api/ask")
    .send({ question: "How many days can employees work remotely?" });

  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toContain("text/event-stream");

  const events = response.text.trim().split("\n\n");

  expect(events).toEqual([
    `event: chunk\ndata: ${JSON.stringify({
      text: "Employees may work remotely "
    })}`,
    `event: chunk\ndata: ${JSON.stringify({
      text: "up to three days per week [demo-001]."
    })}`,
    `event: sources\ndata: ${JSON.stringify({
      sources: [
        {
          id: "demo-001",
          title: "Demo Company Remote Work Policy"
        }
      ]
    })}`,
    `event: done\ndata: ${JSON.stringify({ simulated: false })}`
  ]);
});

test("sends an error event if generation fails during streaming", async () => {
  vi.clearAllMocks();

  async function* failingStream() {
    yield* createFakeStream(["Partial answer"]);
    throw new Error("Provider connection lost");
  }

  vi.mocked(gemini.models.generateContentStream)
    .mockResolvedValueOnce(failingStream());

  const response = await request(app)
    .post("/api/ask")
    .send({ question: "What is the remote work policy?" });

  expect(response.status).toBe(200);

  const events = response.text.trim().split("\n\n");

  expect(events).toEqual([
    `event: chunk\ndata: ${JSON.stringify({
      text: "Partial answer"
    })}`,
    `event: error\ndata: ${JSON.stringify({
      error: "Unable to complete the answer"
    })}`
  ]);
});