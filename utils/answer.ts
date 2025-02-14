import { OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (prompt: string, apiKey: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/chat/completions`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    method: "POST",
    body: JSON.stringify({
      model: process.env.NEXT_PUBLIC_MODEL || OpenAIModel.DAVINCI_TURBO,
      messages: [
        { role: "system", content: "You are a helpful assistant that accurately answers the user's queries based on the given text." },
        { role: "user", content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.2,
      stream: true,
      top_p: 0.95,
      frequency_penalty: 0,
      n: 1,
      presence_penalty: 0

    })
  });

  if (res.status !== 200) {
    console.error(await res.text());
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });
  
  return stream;
};
