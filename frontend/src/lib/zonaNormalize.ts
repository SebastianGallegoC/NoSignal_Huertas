/** Normaliza zona urbana/rural desde Excel (mayúsculas, espacios, tildes). */
export function normalizeZonaImportValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "";
  }
  const key = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (key === "urbana" || key === "urbano") {
    return "Urbana";
  }
  if (key === "rural") {
    return "Rural";
  }
  return trimmed;
}
