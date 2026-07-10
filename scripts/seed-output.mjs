// scripts/seed-output.mjs — extract the JSON result object from
// `npx convex run seed:bootstrapOperator` output, which may be surrounded
// by CLI banner lines.
export function extractSeedResult(stdout) {
  const start = stdout.indexOf("{");
  if (start === -1) return null;
  // Try successively shorter substrings ending at each "}" from the last one
  // backwards, so trailing non-JSON noise doesn't break parsing.
  let end = stdout.lastIndexOf("}");
  while (end > start) {
    try {
      return JSON.parse(stdout.slice(start, end + 1));
    } catch {
      end = stdout.lastIndexOf("}", end - 1);
    }
  }
  return null;
}
