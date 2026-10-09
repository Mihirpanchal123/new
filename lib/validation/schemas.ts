import { z } from "zod";
import { AVATAR_COLOR_IDS, AVATAR_IDS } from "@/constants/profile";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  GUESS_MAX_LENGTH,
  MAX_CHAIN_LENGTH,
  MAX_TURN_MS,
  MIN_CHAIN_LENGTH,
  MIN_TURN_MS,
  ROOM_CODE_LENGTH,
  ROOM_CODE_PATTERN,
  WORD_MAX_LENGTH,
} from "@/constants/game";
import { containsProfanity } from "./profanity";

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH, `Game codes are ${ROOM_CODE_LENGTH} characters.`)
  .regex(ROOM_CODE_PATTERN, "That doesn't look like a game code.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, `At least ${DISPLAY_NAME_MIN_LENGTH} characters.`)
  .max(DISPLAY_NAME_MAX_LENGTH, `At most ${DISPLAY_NAME_MAX_LENGTH} characters.`)
  .regex(/^[\p{L}\p{N} _'-]+$/u, "Letters, numbers, spaces, - and _ only.")
  .refine((v) => !containsProfanity(v), "Please choose a friendlier name.")
  .transform((v) => v.replace(/\s+/g, " "));

export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    avatar: z.enum(AVATAR_IDS).optional(),
    color: z.enum(AVATAR_COLOR_IDS as [string, ...string[]]).optional(),
  })
  .strict();

const actionId = z.string().min(8).max(64);

export const settingsSchema = z
  .object({
    chainLength: z.number().int().min(MIN_CHAIN_LENGTH).max(MAX_CHAIN_LENGTH),
    turnMs: z.number().int().min(MIN_TURN_MS).max(MAX_TURN_MS).nullable(),
  })
  .strict();

export const payloadSchemas = {
  code: z.object({ code: roomCodeSchema }),
  create: z.object({ settings: settingsSchema.optional() }),
  settings: z.object({ code: roomCodeSchema, settings: settingsSchema }),
  ready: z.object({ code: roomCodeSchema, ready: z.boolean() }),
  chain: z.object({
    code: roomCodeSchema,
    words: z.array(z.string().max(WORD_MAX_LENGTH * 3)).min(MIN_CHAIN_LENGTH).max(MAX_CHAIN_LENGTH),
  }),
  guess: z.object({
    code: roomCodeSchema,
    turnId: z.number().int().nonnegative(),
    guess: z.string().max(GUESS_MAX_LENGTH * 2),
    actionId,
  }),
  skip: z.object({
    code: roomCodeSchema,
    turnId: z.number().int().nonnegative(),
    expectedRevealed: z.number().int().min(0).max(WORD_MAX_LENGTH),
    actionId,
  }),
  rematchRespond: z.object({ code: roomCodeSchema, accept: z.boolean() }),
  voiceSignal: z.object({
    code: roomCodeSchema,
    signal: z.discriminatedUnion("type", [
      z.object({ type: z.literal("join"), reply: z.boolean(), muted: z.boolean() }).strict(),
      z.object({ type: z.literal("leave") }).strict(),
      z.object({ type: z.literal("mute"), muted: z.boolean() }).strict(),
      z
        .object({
          type: z.literal("description"),
          description: z
            .object({ type: z.enum(["offer", "answer", "pranswer", "rollback"]), sdp: z.string().max(20_000).optional() })
            .strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal("candidate"),
          candidate: z
            .object({
              candidate: z.string().max(1_000),
              sdpMid: z.string().max(64).nullable().optional(),
              sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
              usernameFragment: z.string().max(256).nullable().optional(),
            })
            .strict(),
        })
        .strict(),
    ]),
  }),
} as const;
