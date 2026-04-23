import { z } from "zod";

export const captchaSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  adminId: z.string(),
  messageId: z.number(),
  answer: z.tuple([z.string(), z.string(), z.string()]),
  progress: z.array(z.string()).max(3),
  attempts: z.number().max(3),
  createdAt: z.number(),
  name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
});

export type CaptchaSession = z.infer<typeof captchaSchema>;
