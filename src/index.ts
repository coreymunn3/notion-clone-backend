import OpenAI from 'openai';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
	OPEN_AI_KEY: string;
	AI: Ai;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	'/*',
	cors({
		origin: '*',
		allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type'],
		allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT'],
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
		maxAge: 600,
		credentials: true,
	})
);

app.get('/hello', async (c) =>
	c.json({
		message: 'Hello!',
	})
);

app.post('/translate-document', async (c) => {
	const body = await c.req.json();
	const { documentData, sourceLanguage, targetLanguage } = body;
	// generate a summary of the doc
	const summaryResponse = await c.env.AI.run('@cf/facebook/bart-large-cnn', { input_text: documentData, max_length: 500 });
	// translate the summary into another language
	const translatedSummary = await c.env.AI.run('@cf/meta/m2m100-1.2b', {
		text: summaryResponse.summary,
		source_lang: sourceLanguage || 'english',
		target_lang: targetLanguage,
	});
	return c.json({
		text: translatedSummary,
	});
});

/**
 * Documentation and examples here https://github.com/openai/openai-node
 */
app.post('/chat-to-document', async (c) => {
	const { documentData, question } = await c.req.json();
	const openai = new OpenAI({
		apiKey: c.env.OPEN_AI_KEY,
	});

	const chatCompletion = await openai.chat.completions.create({
		messages: [
			{
				role: 'system',
				content:
					'You are an assistant helping the user to chat to a document. I am providing a JSON file of the markdown for that document. Using this, answer the users question in the clearest way possible, this document is about ' +
					documentData,
			},
			{
				role: 'user',
				content: 'My question is: ' + question,
			},
		],
		model: 'gpt-4o',
		temperature: 0.5,
	});

	const resp = chatCompletion.choices[0].message.content;
	return c.json({
		message: resp,
	});
});

export default app;
