document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get("domain") || "This site";
  document.getElementById("blocked-domain").textContent = domain;
});
