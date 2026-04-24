import express from "express";
import session from "express-session";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const dataPath = path.join(__dirname, "data.json");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "piano-mvp-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);

app.use(express.static(projectRoot));

function loadData() {
  if (!fs.existsSync(dataPath)) {
    return { users: [], orders: [], purchases: [] };
  }
  const raw = fs.readFileSync(dataPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return { users: [], orders: [], purchases: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("Not logged in");
  }
  next();
}

function getUser(data, id) {
  return data.users.find((u) => u.id === id);
}

app.post("/api/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) {
    return res.status(400).send("Invalid input");
  }
  const data = loadData();
  if (data.users.some((u) => u.email === email)) {
    return res.status(409).send("Email exists");
  }
  const user = {
    id: uuidv4(),
    email,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  data.users.push(user);
  saveData(data);
  req.session.userId = user.id;
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).send("Invalid input");
  }
  const data = loadData();
  const user = data.users.find((u) => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).send("Invalid credentials");
  }
  req.session.userId = user.id;
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  const data = loadData();
  const user = getUser(data, req.session.userId);
  if (!user) {
    return res.status(401).send("Invalid session");
  }
  const unlocked = data.purchases.some(
    (p) => p.userId === user.id && p.songId === "demo-song"
  );
  res.json({
    user: { id: user.id, email: user.email },
    unlocked,
  });
});

app.post("/api/orders", requireAuth, (req, res) => {
  const { songId, channel } = req.body || {};
  if (!songId) {
    return res.status(400).send("Missing songId");
  }
  const data = loadData();
  const order = {
    id: uuidv4(),
    userId: req.session.userId,
    songId,
    channel: channel || "wechat",
    amount: 1200,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  data.orders.push(order);
  saveData(data);
  res.json({ id: order.id, status: order.status });
});

app.post("/api/orders/:id/mock-pay", requireAuth, (req, res) => {
  const data = loadData();
  const order = data.orders.find((o) => o.id === req.params.id);
  if (!order || order.userId !== req.session.userId) {
    return res.status(404).send("Order not found");
  }
  order.status = "PAID";
  if (!data.purchases.some((p) => p.userId === order.userId && p.songId === order.songId)) {
    data.purchases.push({
      id: uuidv4(),
      userId: order.userId,
      songId: order.songId,
      paidAt: new Date().toISOString(),
      channel: order.channel,
    });
  }
  saveData(data);
  res.json({ ok: true });
});

app.post("/api/pay/wechat/prepay", requireAuth, (req, res) => {
  res.status(501).json({
    error: "WeChat Pay not configured",
    hint: "Set WECHAT_APPID/WECHAT_MCH_ID/WECHAT_API_KEY and implement prepay.",
  });
});

app.post("/api/pay/alipay/prepay", requireAuth, (req, res) => {
  res.status(501).json({
    error: "Alipay not configured",
    hint: "Set ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY and implement prepay.",
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Node backend listening on http://localhost:${port}`);
});
