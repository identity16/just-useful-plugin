/**
 * just-useful-plugin for OpenCode.ai
 *
 * Injects skill context into OpenCode's system prompt.
 */

const fs = require("fs");
const path = require("path");

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      fm[key.trim()] = rest.join(":").trim();
    }
  });
  return fm;
}

function getPluginRoot() {
  return path.resolve(__dirname, "../..");
}

module.exports = {
  name: "just-useful-plugin",

  init() {
    const root = getPluginRoot();
    const skillsDir = path.join(root, "skills");

    if (!fs.existsSync(skillsDir)) return { skills: [] };

    const skills = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const skillPath = path.join(skillsDir, d.name, "SKILL.md");
        if (!fs.existsSync(skillPath)) return null;
        const content = fs.readFileSync(skillPath, "utf-8");
        const fm = extractFrontmatter(content);
        return {
          name: fm.name || d.name,
          description: fm.description || "",
          path: skillPath,
        };
      })
      .filter(Boolean);

    return { skills };
  },
};
