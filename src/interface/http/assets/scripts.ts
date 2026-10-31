/** Client scripts served from /assets/*.js so the CSP can forbid inline scripts. Kept tiny on purpose. */

export const AUTH_JS = `
window.onGoogleCredential = async function (response) {
  const result = await fetch("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: response.credential }),
    credentials: "same-origin"
  });
  if (!result.ok) { alert("Não foi possível entrar com o Google. Tente novamente."); return; }
  const next = new URLSearchParams(location.search).get("next");
  location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : location.pathname === "/login" ? "/" : location.href;
};
`;

export const ORDER_STATUS_JS = `
(function () {
  const root = document.getElementById("order-status");
  if (!root) { return; }
  const url = root.dataset.statusUrl;
  const intervalMs = Number(root.dataset.intervalMs || "5000");
  async function poll() {
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      const body = await response.json();
      if (body.status !== "pending") { location.reload(); return; }
    } catch (error) { console.warn("status poll failed", error); }
    setTimeout(poll, intervalMs);
  }
  setTimeout(poll, intervalMs);
  const copyButton = document.getElementById("copy-pix");
  if (copyButton) {
    copyButton.addEventListener("click", async function () {
      const input = document.getElementById("pix-code");
      await navigator.clipboard.writeText(input.value);
      copyButton.textContent = "Copiado!";
    });
  }
})();
`;

export const SHARE_JS = `
(function () {
  const button = document.getElementById("share-event");
  if (!button) { return; }
  button.addEventListener("click", async function () {
    const data = { title: button.dataset.title, url: button.dataset.url };
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(data.url);
    button.textContent = "Link copiado!";
  });
})();
`;

export const CHECKIN_JS = `
(function () {
  const form = document.getElementById("checkin-form");
  const resultBox = document.getElementById("checkin-result");
  const video = document.getElementById("scanner");
  let busy = false;
  async function submitCode(code) {
    if (busy || !code) { return; }
    busy = true;
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code }),
      credentials: "same-origin"
    });
    const body = await response.json();
    resultBox.className = "alert " + (body.ok ? "ok" : "err");
    resultBox.textContent = body.message;
    setTimeout(function () { busy = false; }, 2500);
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitCode(form.code.value.trim());
    form.code.value = "";
  });
  async function startScanner() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices) { return; }
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    await video.play();
    video.hidden = false;
    async function scan() {
      const codes = await detector.detect(video);
      if (codes.length > 0) { await submitCode(codes[0].rawValue); }
      requestAnimationFrame(scan);
    }
    scan();
  }
  document.getElementById("start-scanner").addEventListener("click", function () {
    startScanner().catch(function (error) { resultBox.className = "alert err"; resultBox.textContent = "Câmera indisponível: digite o código."; console.warn(error); });
  });
})();
`;
