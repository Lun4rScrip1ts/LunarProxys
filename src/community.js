import { randomBytes, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import express from "express";

const scrypt = promisify(scryptCallback);
const router = express.Router();

const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "community.json");
const SESSION_DAYS = 30;
const MAX_MESSAGES = 500;
const MAX_MESSAGE_LENGTH = 500;
const MAX_USERS = 10000;

let state = { users: {}, sessions: {}, messages: [] };
let writeQueue = Promise.resolve();

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = {
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
        messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-MAX_MESSAGES) : [],
      };
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
    await writeFile(temp, snapshot, "utf8");
    await rename(temp, DATA_FILE);
  }).catch(error => console.error("[Lunar Community] Save failed:", error.message));
  return writeQueue;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function validUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href.slice(0, 1000) : "";
  } catch {
    return "";
  }
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

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    status: user.status || "",
    createdAt: user.createdAt,
  };
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

router.get("/auth/me", (req, res) => {
  const user = getSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

router.post("/auth/register", async (req, res) => {
  const username = cleanText(req.body?.username, 24);
  const password = req.body?.password;
  const displayName = cleanText(req.body?.displayName, 32) || username;
  const avatarUrl = validUrl(cleanText(req.body?.avatarUrl, 1000));
  const bio = cleanText(req.body?.bio, 160);
  const status = cleanText(req.body?.status, 80);

  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 3–24 characters using letters, numbers, or underscores." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." });

  const usernameKey = username.toLowerCase();
  if (Object.values(state.users).some(user => user.username.toLowerCase() === usernameKey)) {
    return res.status(409).json({ error: "That username is already taken." });
  }
  if (Object.keys(state.users).length >= MAX_USERS) return res.status(503).json({ error: "Registration is temporarily full." });

  const credentials = await hashPassword(password);
  const user = {
    id: randomUUID(),
    username,
    displayName,
    avatarUrl,
    bio,
    status,
    salt: credentials.salt,
    hash: credentials.hash,
    createdAt: new Date().toISOString(),
  };

  state.users[user.id] = user;
  setSession(res, user.id);
  await persist();
  res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const username = cleanText(req.body?.username, 24);
  const password = req.body?.password;
  const user = Object.values(state.users).find(item => item.username.toLowerCase() === username.toLowerCase());

  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  setSession(res, user.id);
  await persist();
  res.json({ user: publicUser(user) });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.lunar_session;
  if (token) delete state.sessions[token];
  res.clearCookie("lunar_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await persist();
  res.json({ ok: true });
});

router.patch("/profile", requireUser, async (req, res) => {
  const displayName = cleanText(req.body?.displayName, 32);
  const bio = cleanText(req.body?.bio, 160);
  const status = cleanText(req.body?.status, 80);
  const avatarUrl = validUrl(cleanText(req.body?.avatarUrl, 1000));

  if (!displayName) return res.status(400).json({ error: "Display name cannot be empty." });
  req.user.displayName = displayName;
  req.user.bio = bio;
  req.user.status = status;
  req.user.avatarUrl = avatarUrl;
  await persist();
  res.json({ user: publicUser(req.user) });
});

router.get("/chat/messages", (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 100);
  res.json({ messages: state.messages.slice(-limit) });
});

router.post("/chat/messages", requireUser, async (req, res) => {
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  if (!text) return res.status(400).json({ error: "Message cannot be empty." });

  const now = Date.now();
  const last = state.messages.slice().reverse().find(message => message.userId === req.user.id);
  if (last && now - Date.parse(last.createdAt) < 1500) {
    return res.status(429).json({ error: "Slow down a little." });
  }

  const message = {
    id: randomUUID(),
    userId: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl || "",
    message: text,
    createdAt: new Date(now).toISOString(),
  };

  state.messages.push(message);
  if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
  await persist();
  res.status(201).json({ message });
});

await loadState();

export default router;
