import { expect, test, vi } from "vitest";
import { readAnswerStream } from "./readAnswerStream";

const createStream = (chunks: Uint8Array[]) => {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(chunk);
            }

            controller.close();
        }
    })
}

test("recontructs an event split across network chunks", async () => {
    const encoder = new TextEncoder();

    const stream = createStream([
        encoder.encode('event: chunk\ndata: {"te'),
        encoder.encode('xt":"Hello"}\n'),
        encoder.encode('\nevent: done\ndata: {"simulated":false}\n\n')
    ])

    const onText = vi.fn();
    const onSources = vi.fn();

    await readAnswerStream(stream, { onText, onSources });

    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith("Hello");
    expect(onSources).not.toHaveBeenCalled();
    expect(stream.locked).toBe(false);

})

test("preserves a Unicode character split across byte chunks", async () => {
    const encoder = new TextEncoder();

    const text =
        'event: chunk\ndata: {"text":"Hello 🌍"}\n\n' +
        'event: done\ndata: {"simulated":false}\n\n';

    const bytes = encoder.encode(text);

    const emojiStart = encoder.encode(
        text.slice(0, text.indexOf("🌍"))
    ).length;

    const stream = createStream([
        bytes.slice(0, emojiStart + 2),
        bytes.slice(emojiStart + 2)
    ]);

    const onText = vi.fn();
    const onSources = vi.fn();

    await readAnswerStream(stream, { onText, onSources });

    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith("Hello 🌍");
    expect(stream.locked).toBe(false);

});

test("rejects a connection ending before the done event", async () => {
    const encoder = new TextEncoder();

    const stream = createStream([
        encoder.encode(
            'event: chunk\ndata: {"text":"Partial answer"}\n\n'
        )
    ]);

    const onText = vi.fn();
    const onSources = vi.fn();

    await expect(
        readAnswerStream(stream, { onText, onSources })
    ).rejects.toThrow(
        "The connection ended before the answer was complete."
    );

    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith("Partial answer");
    expect(onSources).not.toHaveBeenCalled();
    expect(stream.locked).toBe(false);
});