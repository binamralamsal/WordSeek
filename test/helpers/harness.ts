import { Bot } from "grammy";

import type { Message, Update, User, UserFromGetMe } from "grammy/types";

import { createAppComposer } from "#/app";
import { env } from "#/config/env";

export const TEST_BOT_INFO: UserFromGetMe = {
  id: 123456789,
  is_bot: true,
  first_name: "WordSeek Test",
  username: "wordseek_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: true,
  allows_users_to_create_topics: true,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

export type ChatMemberStatus =
  "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";

export interface RecordedCall {
  method: string;
  payload: Record<string, any>;
}

let updateCounter = 0;
let messageCounter = 2_000;

function nextUpdateId(): number {
  updateCounter += 1;
  return updateCounter;
}

function nextMessageId(): number {
  messageCounter += 1;
  return messageCounter;
}

export interface TestUserOptions {
  id?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export function testUser(options: TestUserOptions = {}): User {
  return {
    id: options.id ?? 7_001,
    is_bot: false,
    first_name: options.firstName ?? "Tester",
    last_name: options.lastName,
    username: options.username,
  };
}

function commandEntities(text: string): Message["entities"] {
  const entities: NonNullable<Message["entities"]> = [];

  if (text.startsWith("/")) {
    const command = text.split(/\s+/)[0]!;
    const length = command.includes("@")
      ? command.indexOf("@")
      : command.length;
    entities.push({ type: "bot_command", offset: 0, length });
  }

  const mention = /(^|\s)@([a-zA-Z0-9_]{3,})/g;
  for (const match of text.matchAll(mention)) {
    const offset = (match.index ?? 0) + match[1]!.length;
    entities.push({
      type: "mention",
      offset,
      length: match[0].length - match[1]!.length,
    });
  }

  return entities.length > 0 ? entities : undefined;
}

interface MessageOptions extends TestUserOptions {
  chatId?: number;
  chatType?: "private" | "group" | "supergroup" | "channel" | "forum";
  title?: string;
  isForum?: boolean;
  messageThreadId?: number;
  replyTo?: Message;
  date?: number;
}

function baseMessage(text: string, options: MessageOptions): Update {
  const from = testUser(options);
  const chatType = options.chatType ?? "private";
  const chatId =
    options.chatId ??
    (chatType === "private" ? from.id : -1_000_000_000 - from.id);

  const chat = (
    chatType === "private"
      ? {
          id: chatId,
          type: "private" as const,
          first_name: from.first_name,
          last_name: from.last_name,
          username: from.username,
        }
      : {
          id: chatId,
          type: chatType === "forum" ? "supergroup" : chatType,
          title: options.title ?? "Test Chat",
          is_forum:
            options.isForum ??
            (chatType === "supergroup" || chatType === "forum"),
        }
  ) as Message["chat"];

  const message: Message = {
    message_id: nextMessageId(),
    date: options.date ?? Math.floor(Date.now() / 1000),
    chat,
    from,
    text,
    entities: commandEntities(text),
    message_thread_id: options.messageThreadId,
    reply_to_message: options.replyTo as Message["reply_to_message"],
  };

  return { update_id: nextUpdateId(), message } as Update;
}

export function privateMessageUpdate(
  text: string,
  options: Omit<MessageOptions, "chatType"> = {},
): Update {
  return baseMessage(text, { ...options, chatType: "private" });
}

export function groupMessageUpdate(
  text: string,
  options: Omit<MessageOptions, "chatType"> = {},
): Update {
  return baseMessage(text, {
    ...options,
    chatType: "supergroup",
    isForum: false,
  });
}

export function forumMessageUpdate(
  text: string,
  options: Omit<MessageOptions, "chatType"> = {},
): Update {
  return baseMessage(text, {
    ...options,
    chatType: "supergroup",
    isForum: true,
  });
}

export interface CallbackOptions extends TestUserOptions {
  chatId?: number;
  chatType?: "private" | "group" | "supergroup";
  title?: string;
  messageId?: number;
  messageText?: string;
}

export function callbackQueryUpdate(
  data: string,
  options: CallbackOptions = {},
): Update {
  const from = testUser(options);
  const chatType = options.chatType ?? "private";
  const chatId =
    options.chatId ??
    (chatType === "private" ? from.id : -1_000_000_000 - from.id);

  const chat =
    chatType === "private"
      ? {
          id: chatId,
          type: "private" as const,
          first_name: from.first_name,
          last_name: from.last_name,
          username: from.username,
        }
      : {
          id: chatId,
          type: chatType as "group" | "supergroup",
          title: options.title ?? "Test Chat",
        };

  const message: Message = {
    message_id: options.messageId ?? nextMessageId(),
    date: Math.floor(Date.now() / 1000),
    chat,
    from: TEST_BOT_INFO as User,
    text: options.messageText ?? "Previous message",
  };

  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: `callback-${updateCounter}`,
      from,
      chat_instance: "test-chat-instance",
      data,
      message,
    },
  };
}

export function myChatMemberUpdate(
  status: "member" | "left" | "kicked",
  options: MessageOptions = {},
): Update {
  const from = testUser(options);
  const chatId = options.chatId ?? -1_000_000_000 - from.id;

  return {
    update_id: nextUpdateId(),
    my_chat_member: {
      chat: {
        id: chatId,
        type: "supergroup",
        title: options.title ?? "Test Chat",
      },
      from,
      date: Math.floor(Date.now() / 1000),
      old_chat_member: {
        status: "left",
        user: TEST_BOT_INFO as User,
      },
      new_chat_member: {
        status,
        user: TEST_BOT_INFO as User,
      },
    },
  } as Update;
}

export function forumTopicEditedUpdate(options: {
  chatId: number;
  messageThreadId: number;
  name?: string;
  iconCustomEmojiId?: string;
}): Update {
  return {
    update_id: nextUpdateId(),
    message: {
      message_id: nextMessageId(),
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: options.chatId,
        type: "supergroup",
        title: "Test Chat",
        is_forum: true,
      },
      from: { id: 999, is_bot: false, first_name: "Admin" },
      message_thread_id: options.messageThreadId,
      forum_topic_edited: {
        name: options.name,
        icon_custom_emoji_id: options.iconCustomEmojiId,
      },
      is_topic_message: true,
    },
  } as Update;
}

/**
 * Mounts the real production middleware stack on a bot whose Telegram API is
 * replaced by an in-memory recorder.
 */
export class TestBot {
  readonly bot: Bot;
  readonly calls: RecordedCall[] = [];
  readonly errors: unknown[] = [];

  chatMemberStatus: ChatMemberStatus = "member";
  private nextId = 5_000;

  constructor() {
    this.bot = new Bot(env.BOT_TOKEN, { botInfo: TEST_BOT_INFO });

    this.bot.api.config.use((_prev, method, payload) => {
      this.calls.push({
        method: method as string,
        payload: payload as Record<string, any>,
      });

      return Promise.resolve({
        ok: true,
        result: this.resultFor(
          method as string,
          payload as Record<string, any>,
        ),
      }) as never;
    });

    this.bot.use(createAppComposer());
    this.bot.catch((error) => {
      this.errors.push(error.error);
    });
  }

  private nextMessageId(): number {
    this.nextId += 1;
    return this.nextId;
  }

  private resultFor(method: string, payload: Record<string, any>): unknown {
    switch (method) {
      case "getMe":
        return TEST_BOT_INFO;
      case "getChatMember":
        return {
          status: this.chatMemberStatus,
          user: {
            id: payload.user_id,
            is_bot: false,
            first_name: "Member",
          },
        };
      case "getChat":
        return {
          id: payload.chat_id,
          type: "supergroup",
          title: "Test Chat",
          is_forum: true,
        };
      case "getChatAdministrators":
        return [];
      case "createForumTopic":
        return {
          message_thread_id: this.nextMessageId(),
          name: payload.name,
          icon_custom_emoji_id: payload.icon_custom_emoji_id,
        };
      case "sendDice":
        return this.sentMessage(payload.chat_id, {
          dice: { emoji: payload.emoji ?? "🎰", value: 3 },
        });
      case "sendMessage":
      case "sendPhoto":
      case "sendDocument":
      case "sendVideo":
      case "sendAnimation":
      case "copyMessage":
      case "forwardMessage":
        return this.sentMessage(payload.chat_id, {
          text: payload.text,
          caption: payload.caption,
        });
      case "sendRichMessage":
        return this.sentMessage(payload.chat_id, {
          rich_message: payload.rich_message,
        });
      default:
        return true;
    }
  }

  private sentMessage(chatId: number | string, extra: Record<string, unknown>) {
    return {
      message_id: this.nextMessageId(),
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(chatId), type: "private" },
      ...extra,
    };
  }

  async send(update: Update): Promise<void> {
    await this.bot.handleUpdate(update);
  }

  async sendText(text: string, options: MessageOptions = {}): Promise<void> {
    const { chatType = "private", ...rest } = options;
    const update =
      chatType === "private"
        ? privateMessageUpdate(text, rest)
        : chatType === "forum"
          ? forumMessageUpdate(text, rest)
          : chatType === "group" || chatType === "supergroup"
            ? groupMessageUpdate(text, rest)
            : baseMessage(text, { ...rest, chatType });
    await this.send(update);
  }

  async click(data: string, options: CallbackOptions = {}): Promise<void> {
    await this.send(callbackQueryUpdate(data, options));
  }

  callsTo(method: string): RecordedCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  lastCall(method: string): RecordedCall | undefined {
    return this.callsTo(method).at(-1);
  }

  sentMessages(): Record<string, any>[] {
    return this.callsTo("sendMessage").map((call) => call.payload);
  }

  editedMessages(): Record<string, any>[] {
    return [
      ...this.callsTo("editMessageText"),
      ...this.callsTo("editMessageCaption"),
    ].map((call) => call.payload);
  }

  /** All text the bot tried to send or edit, in call order. */
  texts(): string[] {
    return this.calls
      .filter((call) =>
        [
          "sendMessage",
          "sendPhoto",
          "sendDocument",
          "sendVideo",
          "sendAnimation",
          "sendRichMessage",
          "editMessageText",
          "editMessageCaption",
        ].includes(call.method),
      )
      .map((call) =>
        String(
          call.payload.text ??
            call.payload.caption ??
            call.payload.rich_message?.html ??
            "",
        ),
      );
  }

  lastText(): string | undefined {
    return this.texts().at(-1);
  }

  reset(): void {
    this.calls.length = 0;
    this.errors.length = 0;
  }
}
