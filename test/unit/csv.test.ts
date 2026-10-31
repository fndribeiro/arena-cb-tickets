import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "../../src/interface/http/csv";

describe("csv", () => {
  it("quotes values and escapes double quotes", () => {

    expect(csvRow(['Maria "Mari" Silva', "a,b"])).toBe('"Maria ""Mari"" Silva","a,b"');
  });

  it.each(["=HYPERLINK(\"x\")", "+1", "-1", "@SUM(A1)"])("neutralizes formula injection in %s", (value) => {

    expect(csvCell(value).startsWith("\"'")).toBe(true);
  });
});
