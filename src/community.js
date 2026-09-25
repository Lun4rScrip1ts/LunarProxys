import { randomBytes, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import express from "express";
import { promises as fs } from "node:fs";
import { mkdir, rename } from "node:fs/promises";

const scrypt = promisify(scryptCallback);
const router = express.Router();

const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DATA_FILE = path.join(DATA_DIR, "community.json");
const SESSION_DAYS = 365;
const MAX_MESSAGES = 500;
const MAX_MESSAGE_LENGTH = 500;
const MAX_USERS = 10000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_STICKERS = 100;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MAX = 20;
const ALLOWED_REACTIONS = ["👍","❤️","😂","😮","😢","🎉","🔥","👎"];

let state = { users: {}, sessions: {}, messages: [] };
let writeQueue = Promise.resolve();

async function loadState() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = {
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
        messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-MAX_MESSAGES) : [],
      };
      for (const user of Object.values(state.users)) {
        user.username = String(user.username || "").slice(0, USERNAME_MAX);
        user.displayName = String(user.displayName || user.username || "").slice(0, DISPLAY_NAME_MAX);
        user.email = String(user.email || "").toLowerCase();
        user.bannerUrl = String(user.bannerUrl || "");
        user.backgroundUrl = String(user.backgroundUrl || "");
        user.stickers = Array.isArray(user.stickers) ? user.stickers.slice(0, MAX_STICKERS) : [];
      }
      for (const message of state.messages) {
        message.reactions = Array.isArray(message.reactions) ? message.reactions : [];
        message.attachments = Array.isArray(message.attachments) ? message.attachments : [];
        message.replyTo = message.replyTo && typeof message.replyTo === "object" ? message.replyTo : null;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("[Lunar Community] Could not read database:", error.message);
    await persist();
  }
}

async function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    await fs.writeFile(temp, snapshot, "utf8");
    await rename(temp, DATA_FILE);
  }).catch(error => console.error("[Lunar Community] Save failed:", error.message));
  return writeQueue;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254;
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function publicUser(user, includeEmail = true) {
  const result = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    bannerUrl: user.bannerUrl || "",
    backgroundUrl: user.backgroundUrl || "",
    bio: user.bio || "",
    status: user.status || "",
    createdAt: user.createdAt,
    stickers: Array.isArray(user.stickers) ? user.stickers : [],
    isOwner: user.username.toLowerCase() === "lunar",
    roles: user.username.toLowerCase() === "lunar" ? ["Owner"] : [],
  };
  if (includeEmail) result.email = user.email || "";
  return result;
}

function getSessionUser(req) {
  const token = req.cookies?.lunar_session;
  if (!token) return null;
  const session = state.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete state.sessions[token];
    return null;
  }
  return state.users[session.userId] || null;
}

function requireUser(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "You need to log in first." });
  req.user = user;
  next();
}

function setSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  state.sessions[token] = {
    userId,
    expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  res.cookie("lunar_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function imageDataToFile(value) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return null;
  const match = value.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("Only PNG, JPG, WEBP, or GIF images are supported.");
  const extension = match[1].toLowerCase() === "jpeg" || match[1].toLowerCase() === "jpg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Images must be smaller than 8 MB.");
  return { extension, buffer };
}

async function saveImage(dataUrl, userId, kind) {
  if (!dataUrl) return "";
  const image = imageDataToFile(dataUrl);
  if (!image) throw new Error("Invalid image upload.");
  const filename = userId + "-" + kind + "-" + randomUUID() + "." + image.extension;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), image.buffer, { mode: 0o644 });
  return "/uploads/" + filename;
}

function uniqueUsername(username, exceptId = "") {
  const key = username.toLowerCase();
  return !Object.values(state.users).some(user => user.id !== exceptId && user.username.toLowerCase() === key);
}

function uniqueEmail(email, exceptId = "") {
  const key = email.toLowerCase();
  return !Object.values(state.users).some(user => user.id !== exceptId && user.email && user.email.toLowerCase() === key);
}

function updateMessagesForUser(user) {
  for (const message of state.messages) {
    if (message.userId === user.id) {
      message.username = user.username;
      message.displayName = user.displayName;
      message.avatarUrl = user.avatarUrl || "";
    }
    for (const reaction of message.reactions || []) {
      for (const reactor of reaction.users || []) {
        if (reactor.userId === user.id) reactor.username = user.username;
      }
    }
    if (message.replyTo?.userId === user.id) {
      message.replyTo.username = user.username;
      message.replyTo.displayName = user.displayName;
    }
  }
}

function findMessage(id) {
  return state.messages.find(message => message.id === id);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

async function verifyPassword(password, record) {
  try {
    const derived = await scrypt(password, record.salt, 64);
    const expected = Buffer.from(record.hash, "hex");
    const actual = Buffer.from(derived);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

router.get("/auth/me", (req, res) => {
  const user = getSessionUser(req);
  res.json({ user: user ? publicUser(user, true) : null });
});

router.post("/auth/register", async (req, res) => {
  const username = cleanText(req.body?.username, USERNAME_MAX);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = req.body?.password;
  const displayName = cleanText(req.body?.displayName, DISPLAY_NAME_MAX) || username;

  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 4–20 characters using letters, numbers, or underscores." });
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." });
  if (!uniqueUsername(username)) return res.status(409).json({ error: "That username is already taken." });
  if (!uniqueEmail(email)) return res.status(409).json({ error: "That email is already registered." });
  if (Object.keys(state.users).length >= MAX_USERS) return res.status(503).json({ error: "Registration is temporarily full." });

  const credentials = await hashPassword(password);
  const user = {
    id: randomUUID(), username, email, displayName,
    avatarUrl: "", bannerUrl: "", backgroundUrl: "", bio: "", status: "",
    stickers: [], salt: credentials.salt, hash: credentials.hash, createdAt: new Date().toISOString(),
  };

  state.users[user.id] = user;
  setSession(res, user.id);
  await persist();
  res.status(201).json({ user: publicUser(user, true) });
});

router.post("/auth/login", async (req, res) => {
  const identifier = cleanText(req.body?.identifier || req.body?.username, 254);
  const password = req.body?.password;
  const key = identifier.toLowerCase();
  const user = Object.values(state.users).find(item =>
    item.username.toLowerCase() === key || (item.email && item.email.toLowerCase() === key)
  );

  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ error: "Incorrect username/email or password." });
  }

  if (!Array.isArray(user.stickers)) user.stickers = [];
  setSession(res, user.id);
  await persist();
  res.json({ user: publicUser(user, true) });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.lunar_session;
  if (token) delete state.sessions[token];
  res.clearCookie("lunar_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await persist();
  res.json({ ok: true });
});

router.patch("/profile", requireUser, async (req, res) => {
  const username = cleanText(req.body?.username, USERNAME_MAX);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const displayName = cleanText(req.body?.displayName, DISPLAY_NAME_MAX);
  const bio = cleanText(req.body?.bio, 160);
  const status = cleanText(req.body?.status, 80);

  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 4–20 characters using letters, numbers, or underscores." });
  if (!displayName) return res.status(400).json({ error: "Display name cannot be empty." });
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!uniqueUsername(username, req.user.id)) return res.status(409).json({ error: "That username is already taken." });
  if (!uniqueEmail(email, req.user.id)) return res.status(409).json({ error: "That email is already registered." });

  req.user.username = username;
  req.user.email = email;
  req.user.displayName = displayName;
  req.user.bio = bio;
  req.user.status = status;
  if (!Array.isArray(req.user.stickers)) req.user.stickers = [];

  try {
    for (const kind of ["avatar", "banner", "background"]) {
      const field = kind + "Data";
      if (req.body?.[field]) req.user[kind + "Url"] = await saveImage(req.body[field], req.user.id, kind);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  updateMessagesForUser(req.user);
  await persist();
  res.json({ user: publicUser(req.user, true) });
});

router.get("/users/:username", (req, res) => {
  const username = cleanText(req.params.username, USERNAME_MAX).toLowerCase();
  const user = Object.values(state.users).find(item => item.username.toLowerCase() === username);
  if (!user) return res.status(404).json({ error: "Profile not found." });
  res.json({ user: publicUser(user, false) });
});

router.get("/chat/messages", (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 100);
  res.json({ messages: state.messages.slice(-limit) });
});

router.post("/chat/uploads", requireUser, async (req, res) => {
  const kind = ["image","gif","sticker"].includes(req.body?.kind) ? req.body.kind : "image";
  try {
    const url = await saveImage(req.body?.data, req.user.id, "chat-" + kind);
    if (!url) return res.status(400).json({ error: "Choose an image first." });
    res.status(201).json({ url, kind });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/chat/messages", requireUser, async (req, res) => {
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  const attachment = req.body?.attachment && typeof req.body.attachment === "object" ? req.body.attachment : null;
  const replyId = cleanText(req.body?.replyTo, 80);
  if (!text && !attachment) return res.status(400).json({ error: "Message cannot be empty." });
  if (attachment && (!["image","gif","sticker"].includes(attachment.kind) || typeof attachment.url !== "string" || !attachment.url.startsWith("/uploads/"))) {
    return res.status(400).json({ error: "Invalid attachment." });
  }

  const now = Date.now();
  const last = state.messages.slice().reverse().find(message => message.userId === req.user.id);
  if (last && now - Date.parse(last.createdAt) < 1000) return res.status(429).json({ error: "Slow down a little." });

  const replied = replyId ? findMessage(replyId) : null;
  const message = {
    id: randomUUID(),
    userId: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl || "",
    message: text,
    attachments: attachment ? [{ url: attachment.url, kind: attachment.kind, name: cleanText(attachment.name, 80) }] : [],
    replyTo: replied ? {
      id: replied.id, userId: replied.userId, username: replied.username,
      displayName: replied.displayName, message: replied.message || "[attachment]",
    } : null,
    reactions: [],
    createdAt: new Date(now).toISOString(),
    editedAt: "",
  };

  state.messages.push(message);
  if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
  await persist();
  res.status(201).json({ message });
});

router.patch("/chat/messages/:id", requireUser, async (req, res) => {
  const message = findMessage(req.params.id);
  if (!message) return res.status(404).json({ error: "Message not found." });
  if (message.userId !== req.user.id) return res.status(403).json({ error: "You can only edit your own messages." });
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  if (!text && !(message.attachments || []).length) return res.status(400).json({ error: "Message cannot be empty." });
  message.message = text;
  message.editedAt = new Date().toISOString();
  await persist();
  res.json({ message });
});

router.patch("/chat/messages/:id/reactions", requireUser, async (req, res) => {
  const message = findMessage(req.params.id);
  const emoji = cleanText(req.body?.emoji, 8);
  if (!message) return res.status(404).json({ error: "Message not found." });
  if (!ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ error: "Reaction is not available." });
  if (!Array.isArray(message.reactions)) message.reactions = [];

  let reaction = message.reactions.find(item => item.emoji === emoji);
  if (!reaction) {
    reaction = { emoji, users: [] };
    message.reactions.push(reaction);
  }

  const index = reaction.users.findIndex(user => user.userId === req.user.id);
  if (index >= 0) reaction.users.splice(index, 1);
  else reaction.users.push({ userId: req.user.id, username: req.user.username });

  if (!reaction.users.length) message.reactions = message.reactions.filter(item => item.emoji !== emoji);
  await persist();
  res.json({ reactions: message.reactions });
});

router.post("/stickers/save", requireUser, async (req, res) => {
  const url = cleanText(req.body?.url, 1000);
  const name = cleanText(req.body?.name, 50) || "Saved sticker";
  if (!url.startsWith("/uploads/")) return res.status(400).json({ error: "Invalid sticker." });
  if (!Array.isArray(req.user.stickers)) req.user.stickers = [];
  const existing = req.user.stickers.find(sticker => sticker.url === url);
  if (!existing) {
    req.user.stickers.unshift({ id: randomUUID(), url, name, createdAt: new Date().toISOString() });
    req.user.stickers = req.user.stickers.slice(0, MAX_STICKERS);
    await persist();
  }
  res.json({ stickers: req.user.stickers });
});

router.delete("/stickers/:id", requireUser, async (req, res) => {
  if (!Array.isArray(req.user.stickers)) req.user.stickers = [];
  req.user.stickers = req.user.stickers.filter(sticker => sticker.id !== req.params.id);
  await persist();
  res.json({ stickers: req.user.stickers });
});

await loadState();

export default router;
