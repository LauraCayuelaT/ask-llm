export type Source = {
    id: string, 
    title: string
};

type StreamHandlers = {
    onText: (text:string) => void;
    onSources: (sources: Source[]) => void;
}

export const readAnswerStream = async (
    stream: ReadableStream<Uint8Array>,
    handlers: StreamHandlers
): Promise<void>=>{
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let buffer= "";
    let receivedDone= false;

    try {
        while(true){
            const {value,done} = await reader.read();

            if(done){
                if(!receivedDone){
                    throw new Error("The connection ended before the answer was complete. Please try again");
                }

                break;
            }

            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.indexOf("\n\n");

            while(boundary !== -1){
                const eventBlock = buffer.slice(0, boundary);

                buffer = buffer.slice(boundary + 2);

                const lines = eventBlock.split("\n");

                const eventName = lines
                    .find((line)=>line.startsWith("event:"))
                    ?.slice(6)
                    .trim();
                
                const data = lines
                    .filter((line)=>line.startsWith("data:"))
                    .map((line)=>line.slice(5).trimStart())
                    .join("\n");

                if(eventName === "chunk"){
                    const payload: unknown = JSON.parse(data);

                    if(
                        typeof payload !== "object" ||
                        payload === null ||
                        !("text" in payload) ||
                        typeof payload.text !== "string"
                    ){
                        throw new Error("Invalid response received.")
                    }

                    handlers.onText(payload.text);
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

                    handlers.onSources(validSources);
                    
                    }

                    if (eventName === "error") {
                    throw new Error(
                        "The answer was interrupted. It may be incomplete. Please try again."
                    );
                    }

                    if (eventName === "done") {
                    receivedDone = true;
                    }

                boundary = buffer.indexOf("\n\n");
            }
        }

       
    } 
    finally{
        reader.releaseLock();
    }


}