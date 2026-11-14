const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const submitBtn = document.getElementById("loginSubmit");

// Sudah login? langsung lempar ke dashboard.
fetch("/api/auth/me", { credentials: "same-origin" }).then((res) => {
  if (res.ok) window.location.replace("index.html");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Memproses...";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login gagal.");
    }

    window.location.replace("index.html");
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Masuk";
  }
});
