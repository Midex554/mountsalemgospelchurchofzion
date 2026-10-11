/**
 * Vercel serverless function: POST /api/contact
 * Sends the contact form to the church inbox using the Resend email API.
 *
 * Environment variables (set in Vercel > Project > Settings > Environment Variables):
 *   RESEND_API_KEY      required  API key from resend.com
 *   CONTACT_FROM_EMAIL  required  e.g. "Mount Salem Zion Website <website@mountsalemzion.org>"
 *                                 (the domain must be verified in Resend)
 *   CONTACT_TO_EMAIL    optional  defaults to info@mountsalemzion.org
 */

const RATE_LIMIT_MAX = 3; // messages allowed...
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // ...per 10 minutes per IP
const MIN_FILL_TIME_MS = 3000; // humans need more than 3 seconds

// Best-effort limiter: memory is per serverless instance, so it slows spam
// but is not a hard guarantee. See README for adding Vercel Firewall limits.
const hits = new Map();

function tooManyRequests(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return false;
}

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// Remove line breaks so values can never inject extra email headers
const singleLine = (s) =>
  String(s || "")
    .replace(/[\r\n]+/g, " ")
    .trim();

function validate(body) {
  const data = {
    name: singleLine(body.name),
    email: singleLine(body.email),
    phone: singleLine(body.phone),
    subject: singleLine(body.subject),
    message: String(body.message || "").trim(),
  };
  const errors = [];
  if (data.name.length < 2 || data.name.length > 100)
    errors.push("Please enter your full name.");
  if (
    data.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)
  )
    errors.push("Please enter a valid email address.");
  if (data.phone && !/^[+()\d\s-]{7,25}$/.test(data.phone))
    errors.push("Please enter a valid phone number.");
  if (data.subject.length < 3 || data.subject.length > 150)
    errors.push("Please enter a subject.");
  if (data.message.length < 10 || data.message.length > 5000)
    errors.push("Please write a message of 10 to 5000 characters.");
  return { data, errors };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  // Only accept submissions that come from this site
  const origin = req.headers.origin;
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch (_) {
      /* invalid origin */
    }
    if (originHost !== req.headers.host) {
      return res.status(403).json({ ok: false, error: "Request not allowed." });
    }
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  body = body || {};

  // Spam traps: a filled hidden field or an instant submit gets a fake "success"
  if (body.company || Number(body.elapsedMs) < MIN_FILL_TIME_MS) {
    return res.status(200).json({ ok: true });
  }

  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();
  if (tooManyRequests(ip)) {
    return res
      .status(429)
      .json({
        ok: false,
        error:
          "Too many messages sent. Please wait a few minutes and try again.",
      });
  }

  const { data, errors } = validate(body);
  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors[0] });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL || "info@mountsalemzion.org";
  if (!apiKey || !from) {
    console.error(
      "Contact form is missing RESEND_API_KEY or CONTACT_FROM_EMAIL.",
    );
    return res
      .status(500)
      .json({
        ok: false,
        error:
          "The contact form is not set up yet. Please email info@mountsalemzion.org.",
      });
  }

  const html = `
    <h2>New message from the Mount Salem Zion website</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(data.phone || "Not given")}</p>
    <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
    <hr>
    <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`;

  const text =
    `New message from the Mount Salem Zion website\n\n` +
    `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || "Not given"}\n` +
    `Subject: ${data.subject}\n\n${data.message}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.email, // pressing Reply answers the visitor
        subject: `[Website] ${data.subject}`,
        html,
        text,
      }),
    });

    if (!response.ok) {
      console.error("Resend error:", response.status, await response.text());
      return res
        .status(502)
        .json({
          ok: false,
          error: "Your message could not be sent. Please try again later.",
        });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        error: "Something went wrong. Please try again later.",
      });
  }
};
