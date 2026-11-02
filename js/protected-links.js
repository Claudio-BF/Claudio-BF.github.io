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

// Both the encrypted payload and plaintext bundle use a JSON line + binary data.
const splitBundle = (bytes) => {
  const boundary = bytes.indexOf(10);
  if (boundary < 0) throw new Error("Invalid encrypted bundle");
  return [
    JSON.parse(decoder.decode(bytes.subarray(0, boundary))),
    bytes.subarray(boundary + 1),
  ];
};

let payload;
let ciphertext;
try {
  const response = await fetch(root.dataset.payload, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load links (${response.status})`);
  [payload, ciphertext] = splitBundle(new Uint8Array(await response.arrayBuffer()));
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
      ciphertext,
    );
    const [bundle, bytes] = splitBundle(new Uint8Array(plaintext));

    content.innerHTML = bundle.html;
    const links = new Map(
      [...content.querySelectorAll("[data-protected-file]")].map((link) => [
        link.dataset.protectedFile,
        link,
      ]),
    );
    let offset = 0;
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
