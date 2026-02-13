export type ExplanationLanguage = "en" | "pidgin" | "hausa" | "yoruba" | "igbo";

export function languageLabel(lang: ExplanationLanguage) {
  switch (lang) {
    case "pidgin":
      return "Nigerian Pidgin";
    case "hausa":
      return "Hausa";
    case "yoruba":
      return "Yoruba";
    case "igbo":
      return "Igbo";
    default:
      return "English";
  }
}

export function languageInstruction(lang: string | null | undefined) {
  const l = String(lang ?? "en").toLowerCase();
  if (l === "en" || l === "english") return "";
  if (l === "pidgin") {
    return "Explain in simple Nigerian Pidgin, using everyday examples relevant to Nigeria. Keep it respectful and clear.";
  }
  if (l === "hausa") {
    return "Explain in simple Hausa, using everyday examples relevant to Nigeria. Keep it respectful and clear.";
  }
  if (l === "yoruba") {
    return "Explain in simple Yoruba, using everyday examples relevant to Nigeria. Keep it respectful and clear.";
  }
  if (l === "igbo") {
    return "Explain in simple Igbo, using everyday examples relevant to Nigeria. Keep it respectful and clear.";
  }
  return "";
}

