import { useState } from 'react';
import type { SubmitEvent} from "react";

type Source ={
  id: string,
  title: string
}


function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>)=>{
    e.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    setError("");
    setAnswer("");
    setSources([]);
    setLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question: trimmedQuestion })
      });

      if (!response.ok) {
        throw new Error("Unable to generate an answer. Please try again.");
      }

      if (!response.body) {
        throw new Error("Streaming is not available.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer="";
      let receivedDone = false;

      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            if(!receivedDone){
              throw new Error("The connection ended before the answer was complete. Please try again.")
            }

            break;
          }

          buffer += decoder.decode(value, {stream: true});

          let boundary = buffer.indexOf("\n\n");

          while (boundary !== -1) {
            const eventBlock = buffer.slice(0, boundary);

            buffer = buffer.slice(boundary + 2);

            const lines = eventBlock.split("\n");

            const eventName = lines
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim();

            const data = lines 
              .filter((line)=>line.startsWith("data:"))
              .map((line)=> line.slice(5).trimStart())
              .join("\n")

            if (eventName === "chunk") {
              const payload: unknown = JSON.parse(data);

              if (
                typeof payload !== "object" ||
                payload === null ||
                !("text" in payload) ||
                typeof payload.text !== "string"
              ) {
                throw new Error("Invalid response received.");
              }

              const text = payload.text;

              setAnswer((previous) => previous + text);
            }

            if(eventName === "sources"){
              const payload: unknown = JSON.parse(data);

              if(typeof payload !== "object" || payload === null || !("sources" in payload) || !Array.isArray(payload.sources)){
                throw new Error("Invalid sources received.")
              }

              const validSources: Source[]=[];

              for(const source of payload.sources){
                if(
                  typeof source !== "object" || source===null || !("id" in source) || !("title" in source) || typeof source.id !== "string"|| typeof source.title !== "string"
                ){
                  throw new Error("Invalid source received")
                }

                 validSources.push({
                  id: source.id,
                  title: source.title
                })
              }

              setSources(validSources);
             
            }

            if(eventName === "error"){
              throw new Error("The answer was interrupted. It may be incomplete. Please try again")
            }

            if(eventName === "done"){
              receivedDone = true;
            }

            boundary = buffer.indexOf("\n\n");
          }

        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return(
    <main>
      <h1>Ask Demo</h1>
      <p>Ask a question about our fictional remote work policy.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="question">Your Question</label>

        <textarea 
          id="question"
          value={question}
          onChange={(e)=>setQuestion(e.target.value)}
          placeholder='How many days can employees work remotely?'
          required
        />

        <button type="submit" disabled={!question.trim()}>{loading ? "Generating..." : "Ask"}</button>
      </form>
      {error && <p role='alert'>{error}</p> }
      {answer && (
        <section aria-labelledby="answer-heading">
          <h2 id="answer-heading">Answer</h2>
          <p className="answer-text">{answer}</p>
          {sources.length > 0 && (
            <div className="sources">
              <h3>Sources</h3>
               <ul>
                  {sources.map((source) => (
                    <li key={source.id}>
                      <strong>[{source.id}]</strong> {source.title}
                    </li>
                  ))}
                </ul>
            </div>
          )}  
        </section>
      )}
    </main>
  )
}

export default App
