import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

export const evidenceDir = "../evidencias-diseno";

export async function audit(page: Page) {
  const geometry = await page.evaluate(() => {
    const issues: { selector: string; property: string; value: string }[] = [];
    const root = getComputedStyle(document.documentElement);
    const tokenNames = Array.from(root).filter((name) => name.startsWith("--"));
    const palette = new Set(["rgba(0, 0, 0, 0)", "transparent"]);
    const probe = document.createElement("span");
    document.body.append(probe);
    for (const name of tokenNames) {
      const value = root.getPropertyValue(name).trim();
      if (CSS.supports("color", value)) {
        probe.style.color = value;
        palette.add(getComputedStyle(probe).color);
      }
    }
    probe.remove();
    const rules: CSSStyleRule[] = [];
    const visit = (list: CSSRuleList) => {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSStyleRule) rules.push(rule);
        if ("cssRules" in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules);
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (!(el instanceof HTMLElement) || !el.checkVisibility()) continue;
      const css = getComputedStyle(el);
      const selector = `${el.tagName.toLowerCase()}${el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""}`;
      const issue = (property: string, value: string) =>
        issues.push({ selector, property, value });
      if (
        Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ) &&
        parseFloat(css.fontSize) < 12
      )
        issue("font-size", css.fontSize);
      for (const property of [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
      ] as const)
        if (!["0px", "8px", "14px", "22px", "999px"].includes(css[property]))
          issue(property, css[property]);
      for (const [property, cssProperty] of [
        ["color", "color"],
        ["backgroundColor", "background-color"],
      ] as const) {
        if (palette.has(css[property])) continue;
        // Los tintes son datos aprobados; color-mix es válido solo cuando su
        // declaración usa variables del sistema, resueltas sobre este elemento.
        const localProbe = document.createElement("span");
        el.append(localProbe);
        const declarations = [el.style.getPropertyValue(cssProperty)];
        for (const rule of rules) {
          try {
            if (el.matches(rule.selectorText))
              declarations.push(rule.style.getPropertyValue(cssProperty));
          } catch {
            /* Un pseudo-elemento no es un elemento visible independiente. */
          }
        }
        let derived = false;
        for (const declaration of declarations) {
          if (!/var\(--/.test(declaration)) continue;
          const names = [...declaration.matchAll(/var\((--[\w-]+)/g)].map(
            (m) => m[1],
          );
          if (
            !names.every(
              (name) =>
                tokenNames.includes(name) ||
                ["--tinte", "--tinte-marca"].includes(name),
            )
          )
            continue;
          localProbe.style.color = declaration;
          if (getComputedStyle(localProbe).color === css[property])
            derived = true;
        }
        localProbe.remove();
        if (!derived) issue(cssProperty, css[property]);
      }
    }
    return {
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      tokens: [...new Map(issues.map((i) => [JSON.stringify(i), i])).values()],
    };
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return {
    ...geometry,
    axe: axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  };
}

export async function capture(
  page: Page,
  name: string,
  width: number,
  consoleErrors: string[],
) {
  if ((await page.getByRole("dialog").count()) === 0) {
    for (const img of await page
      .locator("main img")
      .filter({ visible: true })
      .all()) {
      await img.scrollIntoViewIfNeeded();
      await expect(img).toHaveJSProperty("complete", true);
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  // Una captura nativa de Chromium de toda la página, nunca un cosido de
  // viewports: el riel, Cooper y la barra aparecen una sola vez.
  await page.screenshot({
    path: `${evidenceDir}/${name}-${width}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `${evidenceDir}/${name}-${width}-viewport.png`,
  });
  const result = await audit(page);
  writeFileSync(
    `${evidenceDir}/${name}-${width}.json`,
    JSON.stringify(
      {
        name,
        width,
        captura: "fullPage nativo sin cosido + primer viewport",
        ...result,
        consola: consoleErrors,
      },
      null,
      2,
    ) + "\n",
  );
  expect.soft(result.overflow, `${name}/${width}: overflow`).toBe(0);
  expect.soft(result.tokens, `${name}/${width}: tokens`).toEqual([]);
  expect.soft(result.axe, `${name}/${width}: axe`).toEqual([]);
  expect.soft(consoleErrors, `${name}/${width}: consola`).toEqual([]);
  return result;
}

export type MotionSample = {
  intervals: number[];
  cls: number;
  longTasks: number[];
  active: boolean;
  previous: number;
  observers: PerformanceObserver[];
};

export async function startSample(page: Page) {
  await page.evaluate(() => {
    const sample: MotionSample = {
      intervals: [],
      cls: 0,
      longTasks: [],
      active: true,
      previous: 0,
      observers: [],
    };
    const shifts = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!entry.hadRecentInput) sample.cls += entry.value;
    });
    shifts.observe({ type: "layout-shift" });
    const tasks = new PerformanceObserver((list) =>
      sample.longTasks.push(...list.getEntries().map((e) => e.duration)),
    );
    tasks.observe({ type: "longtask" });
    sample.observers.push(shifts, tasks);
    (window as Window & { designMotion?: MotionSample }).designMotion = sample;
    const tick = (at: number) => {
      if (!sample.active) return;
      if (sample.previous) sample.intervals.push(at - sample.previous);
      sample.previous = at;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function stopSample(page: Page) {
  return page.evaluate(() => {
    const sample = (window as Window & { designMotion?: MotionSample })
      .designMotion!;
    sample.active = false;
    sample.observers.forEach((o) => o.disconnect());
    const sorted = [...sample.intervals].sort((a, b) => a - b);
    return {
      fps:
        1000 /
        (sample.intervals.reduce((a, b) => a + b, 0) / sample.intervals.length),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      cls: sample.cls,
      longTasks: sample.longTasks,
      frames: sample.intervals.length,
    };
  });
}
