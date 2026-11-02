import { Composer } from "grammy";

import type { Chat, User } from "grammy/types";

import { escapeHtml } from "#/core/format/escape-html.helper";
import { replyNotice } from "#/core/telegram/reply-notice.helper";

const composer = new Composer();

function section(title: string, lines: string[]) {
  return `<blockquote><b>${title}</b><br>${lines
    .filter(Boolean)
    .join("<br>")}</blockquote>`;
}

function field(label: string, value: string | number) {
  return `<b>${label}</b> ${value}`;
}

function fullName(user: { first_name: string; last_name?: string }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

function formatOwnInfo(
  from: User,
  chat: Chat,
  messageId: number,
  messageDate: number,
) {
  const chatTitle = "title" in chat ? chat.title : null;
  const chatUsername = "username" in chat ? chat.username : null;

  return `<h4>🪪 Your Telegram ID</h4>
${section("👤 User", [
  field("ID", `<code>${from.id}</code>`),
  field("Name", escapeHtml(fullName(from))),
  from.username ? field("Username", `@${escapeHtml(from.username)}`) : "",
  from.is_premium ? field("Premium", "Yes") : "",
])}
${section("💬 Chat", [
  field("ID", `<code>${chat.id}</code>`),
  field("Type", escapeHtml(chat.type)),
  chatTitle ? field("Title", escapeHtml(chatTitle)) : "",
  chatUsername ? field("Username", `@${escapeHtml(chatUsername)}`) : "",
])}
${section("📨 Command Message", [
  field("ID", `<code>${messageId}</code>`),
  field("Date", escapeHtml(new Date(messageDate * 1000).toLocaleString())),
])}
<footer>Reply to any message with /id to inspect it.</footer>`;
}

composer.command("id", async (ctx) => {
  if (!ctx.from || !ctx.chat) return;

  const isPrivate = ctx.chat.type === "private";

  if (!isPrivate) {
    const member = await ctx.getChatMember(ctx.from.id);
    const isAdmin =
      member.status === "administrator" || member.status === "creator";

    if (!isAdmin) {
      return replyNotice(
        ctx,
        "This command can only be used by group administrators.",
      );
    }
  }

  const repliedMsg = ctx.message?.reply_to_message;

  if (!repliedMsg) {
    const message = ctx.message!;

    return ctx.replyWithRichMessage(
      {
        html: formatOwnInfo(
          ctx.from,
          ctx.chat,
          message.message_id,
          message.date,
        ),
      },
      { reply_parameters: { message_id: message.message_id } },
    );
  }

  const sections: string[] = [];

  sections.push(
    section("📨 Message Information", [
      field("ID", `<code>${repliedMsg.message_id}</code>`),
      field(
        "Date",
        escapeHtml(new Date(repliedMsg.date * 1000).toLocaleString()),
      ),
    ]),
  );

  if (repliedMsg.from) {
    const from = repliedMsg.from;

    sections.push(
      section("👤 User Information", [
        field("ID", `<code>${from.id}</code>`),
        field("Name", escapeHtml(fullName(from))),
        from.username ? field("Username", `@${escapeHtml(from.username)}`) : "",
        field("Bot", from.is_bot ? "Yes" : "No"),
        from.language_code
          ? field("Language", escapeHtml(from.language_code))
          : "",
        from.is_premium ? field("Premium", "Yes") : "",
      ]),
    );
  }

  sections.push(
    section("💬 Chat Information", [
      field("ID", `<code>${ctx.chat.id}</code>`),
      field("Type", escapeHtml(ctx.chat.type)),
      "title" in ctx.chat && ctx.chat.title
        ? field("Title", escapeHtml(ctx.chat.title))
        : "",
      ctx.chat.username
        ? field("Username", `@${escapeHtml(ctx.chat.username)}`)
        : "",
    ]),
  );

  if (repliedMsg.forward_origin) {
    const origin = repliedMsg.forward_origin;
    const lines = [
      field(
        "Forwarded",
        escapeHtml(new Date(origin.date * 1000).toLocaleString()),
      ),
    ];

    if (origin.type === "user") {
      lines.push(field("Sender ID", `<code>${origin.sender_user.id}</code>`));
      lines.push(field("Sender", escapeHtml(fullName(origin.sender_user))));
      if (origin.sender_user.username) {
        lines.push(
          field("Username", `@${escapeHtml(origin.sender_user.username)}`),
        );
      }
    } else if (origin.type === "channel") {
      lines.push(field("Chat ID", `<code>${origin.chat.id}</code>`));
      lines.push(field("Chat", escapeHtml(origin.chat.title)));
      if (origin.chat.username) {
        lines.push(field("Username", `@${escapeHtml(origin.chat.username)}`));
      }
      lines.push(field("Message ID", `<code>${origin.message_id}</code>`));
    } else if (origin.type === "hidden_user") {
      lines.push(
        field("Sender", `${escapeHtml(origin.sender_user_name)} (hidden)`),
      );
    }

    sections.push(section("↪️ Forward Information", lines));
  }

  if (repliedMsg.photo) {
    const photo = repliedMsg.photo[repliedMsg.photo.length - 1]!;

    sections.push(
      section("🖼️ Photo", [
        field("File ID", `<code>${photo.file_id}</code>`),
        field("Unique ID", `<code>${photo.file_unique_id}</code>`),
        field("Dimensions", `${photo.width}x${photo.height}`),
        photo.file_size
          ? field("Size", `${(photo.file_size / 1024).toFixed(2)} KB`)
          : "",
      ]),
    );
  }

  if (repliedMsg.video) {
    const video = repliedMsg.video;

    sections.push(
      section("🎬 Video", [
        field("File ID", `<code>${video.file_id}</code>`),
        field("Unique ID", `<code>${video.file_unique_id}</code>`),
        field("Dimensions", `${video.width}x${video.height}`),
        field("Duration", `${video.duration}s`),
        video.file_size
          ? field("Size", `${(video.file_size / (1024 * 1024)).toFixed(2)} MB`)
          : "",
        video.mime_type ? field("MIME", escapeHtml(video.mime_type)) : "",
      ]),
    );
  }

  if (repliedMsg.document) {
    const document = repliedMsg.document;

    sections.push(
      section("📄 Document", [
        field("File ID", `<code>${document.file_id}</code>`),
        field("Unique ID", `<code>${document.file_unique_id}</code>`),
        document.file_name ? field("Name", escapeHtml(document.file_name)) : "",
        document.mime_type ? field("MIME", escapeHtml(document.mime_type)) : "",
        document.file_size
          ? field(
              "Size",
              `${(document.file_size / (1024 * 1024)).toFixed(2)} MB`,
            )
          : "",
      ]),
    );
  }

  if (repliedMsg.audio) {
    const audio = repliedMsg.audio;

    sections.push(
      section("🎵 Audio", [
        field("File ID", `<code>${audio.file_id}</code>`),
        field("Unique ID", `<code>${audio.file_unique_id}</code>`),
        field("Duration", `${audio.duration}s`),
        audio.performer ? field("Performer", escapeHtml(audio.performer)) : "",
        audio.title ? field("Title", escapeHtml(audio.title)) : "",
        audio.mime_type ? field("MIME", escapeHtml(audio.mime_type)) : "",
        audio.file_size
          ? field("Size", `${(audio.file_size / (1024 * 1024)).toFixed(2)} MB`)
          : "",
      ]),
    );
  }

  if (repliedMsg.voice) {
    const voice = repliedMsg.voice;

    sections.push(
      section("🎙️ Voice", [
        field("File ID", `<code>${voice.file_id}</code>`),
        field("Unique ID", `<code>${voice.file_unique_id}</code>`),
        field("Duration", `${voice.duration}s`),
        voice.mime_type ? field("MIME", escapeHtml(voice.mime_type)) : "",
        voice.file_size
          ? field("Size", `${(voice.file_size / 1024).toFixed(2)} KB`)
          : "",
      ]),
    );
  }

  if (repliedMsg.sticker) {
    const sticker = repliedMsg.sticker;

    sections.push(
      section("🎨 Sticker", [
        field("File ID", `<code>${sticker.file_id}</code>`),
        field("Unique ID", `<code>${sticker.file_unique_id}</code>`),
        field("Dimensions", `${sticker.width}x${sticker.height}`),
        field("Animated", sticker.is_animated ? "Yes" : "No"),
        field("Video", sticker.is_video ? "Yes" : "No"),
        sticker.emoji ? field("Emoji", escapeHtml(sticker.emoji)) : "",
        sticker.set_name ? field("Set", escapeHtml(sticker.set_name)) : "",
      ]),
    );
  }

  if (repliedMsg.animation) {
    const animation = repliedMsg.animation;

    sections.push(
      section("🎞️ Animation", [
        field("File ID", `<code>${animation.file_id}</code>`),
        field("Unique ID", `<code>${animation.file_unique_id}</code>`),
        field("Dimensions", `${animation.width}x${animation.height}`),
        field("Duration", `${animation.duration}s`),
        animation.file_size
          ? field(
              "Size",
              `${(animation.file_size / (1024 * 1024)).toFixed(2)} MB`,
            )
          : "",
      ]),
    );
  }

  if (repliedMsg.text) {
    sections.push(
      section("📝 Text", [
        field("Length", `${repliedMsg.text.length} characters`),
      ]),
    );
  }

  if (repliedMsg.caption) {
    sections.push(
      section("📝 Caption", [
        field("Length", `${repliedMsg.caption.length} characters`),
      ]),
    );
  }

  await ctx.replyWithRichMessage(
    { html: `<h4>🪪 Message Details</h4>\n${sections.join("\n")}` },
    { reply_parameters: { message_id: ctx.message!.message_id } },
  );
});

export const idCommand = composer;
