// scripts/seed-output.test.mjs — parsing `npx convex run seed:bootstrapOperator` output.
import { describe, expect, test } from "vitest";
import { extractSeedResult } from "./seed-output.mjs";

describe("extractSeedResult", () => {
  test("parses the pretty-printed JSON result from the CLI output", () => {
    const stdout = [
      "{",
      '  "activationToken": "49b51980-ac7f-4d61-88dc-59577c74cd23",',
      '  "created": true,',
      '  "userId": "k57cfjw7vz6cg6nf9xkmt6nmgn8a91m9"',
      "}",
    ].join("\n");
    expect(extractSeedResult(stdout)).toEqual({
      activationToken: "49b51980-ac7f-4d61-88dc-59577c74cd23",
      created: true,
      userId: "k57cfjw7vz6cg6nf9xkmt6nmgn8a91m9",
    });
  });

  test("tolerates CLI banner noise around the JSON", () => {
    const stdout =
      "✔ some banner line\n{\n  \"activationToken\": null,\n  \"created\": false,\n  \"userId\": \"abc\"\n}\ntrailing note";
    expect(extractSeedResult(stdout)).toEqual({
      activationToken: null,
      created: false,
      userId: "abc",
    });
  });

  test("returns null when no JSON object is present", () => {
    expect(extractSeedResult("something went wrong")).toBeNull();
    expect(extractSeedResult("")).toBeNull();
  });
});
