const root = document.querySelector("[data-protected-links]");
const form = root.querySelector("form");
const input = form.querySelector("input");
const button = form.querySelector("button");
const hint = form.querySelector("[data-hint]");
const error = form.querySelector("[data-error]");
const content = root.querySelector("[data-protected-content]");
const decoder = new TextDecoder();

const fromBase64 = (value) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const setBusy = (busy) => {
  input.disabled = button.disabled = busy;
};
const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
};

let payload;
try {
  const response = await fetch(root.dataset.payload, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load links (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const boundary = bytes.indexOf(10);
  if (boundary < 0) throw new Error("Invalid encrypted bundle");
  payload = {
    ...JSON.parse(decoder.decode(bytes.subarray(0, boundary))),
    ciphertext: bytes.subarray(boundary + 1),
  };
  if (payload.hint) {
    hint.textContent = `Hint: ${payload.hint}`;
    hint.hidden = false;
  }
} catch (cause) {
  showError(cause.message);
  setBusy(true);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!payload) return;
  error.hidden = true;
  setBusy(true);

  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(input.value),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: fromBase64(payload.kdf.salt),
        iterations: payload.kdf.iterations,
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.cipher.iv) },
      key,
      payload.ciphertext,
    );
    const bytes = new Uint8Array(plaintext);
    const boundary = bytes.indexOf(10);
    const bundle = JSON.parse(decoder.decode(bytes.subarray(0, boundary)));

    content.innerHTML = bundle.html;
    const links = new Map(
      [...content.querySelectorAll("[data-protected-file]")].map((link) => [
        link.dataset.protectedFile,
        link,
      ]),
    );
    let offset = boundary + 1;
    for (const file of bundle.files) {
      const link = links.get(file.id);
      const fileBytes = bytes.subarray(offset, offset + file.size);
      offset += file.size;
      if (!link) continue;
      link.href = URL.createObjectURL(
        new Blob([fileBytes], { type: file.type }),
      );
      link.target = "_blank";
      link.rel = "noopener";
    }

    input.value = "";
    form.remove();
    content.hidden = false;
  } catch {
    showError("Wrong password.");
    setBusy(false);
    input.select();
  }
});
