import { useState } from 'react';
import type { SubmitEvent} from "react";
import { readAnswerStream } from "./readAnswerStream";
import type { Source } from "./readAnswerStream";

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

      await readAnswerStream(response.body, {
        onText: (text)=> {
          setAnswer(prev=> prev + text);
        },
        onSources: (sources)=>{
          setSources(sources);
        }
      })
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
