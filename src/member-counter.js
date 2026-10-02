import path from "node:path";
import { promises as fs } from "node:fs";
import express from "express";

const router = express.Router();
const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const COMMUNITY_FILE = path.join(DATA_DIR, "community.json");
const COUNTER_FILE = path.join(DATA_DIR, "homepage-counters.json");
const OWNER_NAMES = new Set(["lunar", "lunarstudios"]);

async function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function actualCounts() {
  const state = await readJson(COMMUNITY_FILE, { users: {}, sessions: {} });
  const users = state.users && typeof state.users === "object" ? state.users : {};
  const sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
  const cutoff = Date.now() - 2 * 60 * 1000;
  const onlineUsers = new Set();
  for (const session of Object.values(sessions)) {
    if (session?.kind === "active" && Number(session.lastSeen) > cutoff && users[session.userId]) {
      onlineUsers.add(session.userId);
    }
  }
  const members = Object.keys(users).length;
  const online = onlineUsers.size;
  return { online, offline: Math.max(0, members - online), members };
}

async function authorized(req) {
  const token = req.cookies?.lunar_session;
  if (!token) return false;
  const state = await readJson(COMMUNITY_FILE, { users: {}, sessions: {} });
  const session = state.sessions?.[token];
  const user = session ? state.users?.[session.userId] : null;
  if (!session || !user || Date.now() > Number(session.expiresAt || 0)) return false;
  return OWNER_NAMES.has(String(user.username || "").toLowerCase());
}

async function readOverrides() {
  return readJson(COUNTER_FILE, { enabled: false, online: null, offline: null, members: null });
}

function displayCounts(actual, overrides) {
  const enabled = overrides.enabled === true;
  const value = key => enabled && Number.isFinite(Number(overrides[key])) && Number(overrides[key]) >= 0
    ? Math.floor(Number(overrides[key]))
    : actual[key];
  return { online: value("online"), offline: value("offline"), members: value("members") };
}

router.get("/member-display", async (req, res) => {
  const actual = await actualCounts();
  const overrides = await readOverrides();
  const displayed = displayCounts(actual, overrides);
  res.set("Cache-Control", "no-store");
  res.json({ ...displayed, actual, canEdit: await authorized(req) });
});

router.post("/member-display", async (req, res) => {
  if (!(await authorized(req))) return res.status(403).json({ error: "Only Lunar owners can edit the homepage counters." });
  const current = await readOverrides();
  const next = { enabled: true, online: current.online ?? null, offline: current.offline ?? null, members: current.members ?? null };
  for (const key of ["online", "offline", "members"]) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      const value = Number(req.body[key]);
      if (!Number.isFinite(value) || value < 0 || value > 999999999) return res.status(400).json({ error: `Invalid ${key} counter.` });
      next[key] = Math.floor(value);
    }
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COUNTER_FILE, JSON.stringify(next, null, 2), "utf8");
  const actual = await actualCounts();
  const displayed = displayCounts(actual, next);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...displayed, actual, canEdit: true });
});

router.post("/member-display/reset", async (req, res) => {
  if (!(await authorized(req))) return res.status(403).json({ error: "Only Lunar owners can reset the homepage counters." });
  const actual = await actualCounts();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COUNTER_FILE, JSON.stringify({ enabled: false, online: null, offline: null, members: null }, null, 2), "utf8");
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...actual, canEdit: true });
});

export default router;
