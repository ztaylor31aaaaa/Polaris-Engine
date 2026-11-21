function stripComments(css) { return String(css).replace(/\/\*[\s\S]*?\*\//g, ""); }
export function parseDeclarations(source) {
  const declarations = [];
  for (const part of String(source).split(";")) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const property = part.slice(0, colon).trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    let value = part.slice(colon + 1).trim(), important = false;
    if (!property || !value) continue;
    if (/\s*!important\s*$/i.test(value)) { value = value.replace(/\s*!important\s*$/i, "").trim(); important = true; }
    declarations.push({ property, value, important });
  }
  return declarations;
}
export function parseCSS(css) {
  const source = stripComments(css), rules = [];
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open < 0) break;
    const selector = source.slice(i, open).trim();
    let depth = 1, close = open + 1;
    while (close < source.length && depth) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}") depth--;
      close++;
    }
    if (!depth) {
      const body = source.slice(open + 1, close - 1);
      if (selector && !selector.startsWith("@")) {
        for (const item of selector.split(",")) {
          const trimmed = item.trim();
          if (trimmed) rules.push({ selector: trimmed, declarations: parseDeclarations(body), order: rules.length });
        }
      }
    }
    i = close;
  }
  return rules;
}
export function selectorSpecificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
  const tags = (selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, " ").match(/(?:^|\s|>)\s*[a-zA-Z][\w-]*/g) ?? []).length;
  return ids * 100 + classes * 10 + tags;
}
