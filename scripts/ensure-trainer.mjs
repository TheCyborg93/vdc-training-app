const SUPABASE_URL = "https://sdccnfkymgwloxivnnvb.supabase.co";
const EMAIL = "trainer@vdc-training.de";
const PASSWORD = process.env.TRAINER_INITIAL_PASSWORD;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!PASSWORD) throw new Error("TRAINER_INITIAL_PASSWORD fehlt.");
if (!SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY fehlt.");

const headers = {
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return body;
}

const list = await request("/auth/v1/admin/users?page=1&per_page=1000");
const users = Array.isArray(list) ? list : list?.users || [];
const existing = users.find((user) => user.email?.toLowerCase() === EMAIL.toLowerCase());

const payload = {
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: {
    name: "VDC Trainer",
    role: "TRAINER",
  },
  app_metadata: {
    role: "TRAINER",
  },
};

if (existing) {
  await request(`/auth/v1/admin/users/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  console.log(`Trainer aktualisiert: ${EMAIL}`);
} else {
  await request("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.log(`Trainer erstellt: ${EMAIL}`);
}
