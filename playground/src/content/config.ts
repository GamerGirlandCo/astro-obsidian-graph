import { defineCollection, z } from "astro:content";


const linkSchema = z.object({
	source: z.string(),
	target: z.string(),
});
const root = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		// Transform string to Date object
		pubDate: z.coerce.date().optional(),
		updatedDate: z.coerce.date().optional(),
	}),
});
const random = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string().optional(),
		index: z.number().optional(),
	})
})

export const collections = { root, random };
