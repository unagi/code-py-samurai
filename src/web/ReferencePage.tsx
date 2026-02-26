import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "./asset-url";
import AppFooter from "./AppFooter";

import {
  apiReferenceDocument,
  pickText,
  stdlibModules,
  type LocaleCode,
  type ReferenceItem,
  type ReferenceTag,
} from "./reference/reference-data";

function resolveLocale(language?: string): LocaleCode {
  return language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/** Convert backtick-delimited spans to <code> elements. */
function renderInlineCode(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="refdoc-inline-code">{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}



interface NavLink {
  href: string;
  label: string;
  children?: Array<{ href: string; label: string }>;
}

interface NavGroup {
  id: string;
  title: string;
  links: NavLink[];
}

const ITEM_KIND_ICON: Record<string, string> = {
  method: "bi bi-gear-fill",
  property: "bi bi-key-fill",
  enum: "bi bi-list-columns-reverse",
  class: "bi bi-box-fill",
};

/** Kind-based semantic CSS class for item name colour. */
const ITEM_NAME_CLASS: Partial<Record<string, string>> = {
  method: "refdoc-name--method",
  property: "refdoc-name--property",
  enum: "refdoc-name--enum",
  class: "refdoc-name--class",
};

/** Kind-based CSS class for icon colour (shared colour system with API Outline). */
const ITEM_ICON_CLASS: Partial<Record<string, string>> = {
  method: "refdoc-kind-icon--method",
  property: "refdoc-kind-icon--property",
  enum: "refdoc-kind-icon--enum",
  class: "refdoc-kind-icon--class",
};

type SignatureTokenKind =
  | "plain"
  | "keyword"
  | "func"
  | "name"
  | "literal"
  | "punct";

interface LocalizedTag {
  name: string;
  value: string;
}

interface ItemTagBuckets {
  sinceTag?: string;
  primary: LocalizedTag[];
  secondary: LocalizedTag[];
}

function localizeTags(tags: ReferenceTag[] | undefined, locale: LocaleCode): LocalizedTag[] {
  if (!tags) return [];
  return tags.map((tag) => ({ name: tag.name, value: pickText(tag.value, locale) }));
}

function splitTagBuckets(item: ReferenceItem, locale: LocaleCode): ItemTagBuckets {
  const localized = localizeTags(item.tags, locale);
  const buckets: ItemTagBuckets = {
    primary: [],
    secondary: [],
  };

  for (const tag of localized) {
    if (tag.name === "@type") {
      continue;
    }
    if (tag.name === "@since") {
      buckets.sinceTag = tag.value;
      continue;
    }
    if (tag.name === "@param" || tag.name.startsWith("@param ") || tag.name === "@return") {
      buckets.primary.push(tag);
    } else {
      buckets.secondary.push(tag);
    }
  }

  return buckets;
}

function tokenizeSignature(signature: string, item: ReferenceItem): Array<{ text: string; kind: SignatureTokenKind }> {
  const parts = signature.split(/(\s+|->|[()[\]{}.,:=|])/g).filter((part) => part.length > 0);
  const keywords = new Set(["class", "enum"]);
  const literals = new Set(["None", "True", "False"]);
  const punctuation = new Set(["(", ")", "[", "]", "{", "}", ".", ",", ":", "=", "|", "->"]);
  const functionLike = new Set([item.name]);

  return parts.map((part) => {
    if (/^\s+$/.test(part)) return { text: part, kind: "plain" };
    if (punctuation.has(part)) return { text: part, kind: "punct" };
    if (keywords.has(part)) return { text: part, kind: "keyword" };
    if (literals.has(part) || /^\d+$/.test(part)) return { text: part, kind: "literal" };
    if (functionLike.has(part)) return { text: part, kind: "func" };
    if (/^[A-Za-z_]\w*$/.test(part)) return { text: part, kind: "name" };
    return { text: part, kind: "plain" };
  });
}

function renderSignatureCode(signature: string, item: ReferenceItem) {
  const tokens = tokenizeSignature(signature, item);
  return (
    <code>
      {tokens.map((token, index) => (
        <span
          // index is fine here because tokenization is deterministic for a static string
          key={`${item.id}-sig-${index}-${token.text}`}
          className={token.kind === "plain" ? undefined : `refdoc-code-${token.kind}`}
        >
          {token.text}
        </span>
      ))}
    </code>
  );
}

type PythonTokenKind = "plain" | "keyword" | "func" | "name" | "literal" | "punct" | "comment";

function tokenizePythonExample(code: string): Array<{ text: string; kind: PythonTokenKind }> {
  const result: Array<{ text: string; kind: PythonTokenKind }> = [];
  const keywords = new Set(["if", "else", "elif", "for", "in", "is", "not", "and", "or", "return", "def", "class", "break", "continue"]);
  const builtins = new Set(["None", "True", "False"]);
  const codeTokenRe = /(\s+)|(\.{3})|(==|!=|->|[()[\].,=:])|([A-Za-z_]\w*)|(\d+)|(.)/g;

  for (const [lineIdx, line] of code.split("\n").entries()) {
    if (lineIdx > 0) result.push({ text: "\n", kind: "plain" });

    const hashIdx = line.indexOf("#");
    const codePart = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
    const comment = hashIdx >= 0 ? line.slice(hashIdx) : "";

    let m: RegExpExecArray | null;
    codeTokenRe.lastIndex = 0;
    while ((m = codeTokenRe.exec(codePart)) !== null) {
      const [, ws, ellipsis, punct, ident, num, other] = m;
      if (ws) result.push({ text: ws, kind: "plain" });
      else if (ellipsis) result.push({ text: ellipsis, kind: "punct" });
      else if (punct) result.push({ text: punct, kind: "punct" });
      else if (ident) {
        if (keywords.has(ident)) result.push({ text: ident, kind: "keyword" });
        else if (builtins.has(ident)) result.push({ text: ident, kind: "literal" });
        else result.push({ text: ident, kind: "name" });
      }
      else if (num) result.push({ text: num, kind: "literal" });
      else if (other) result.push({ text: other, kind: "plain" });
    }

    if (comment) result.push({ text: comment, kind: "comment" });
  }

  // Post-pass: name followed by "(" → func
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].kind === "name") {
      let j = i + 1;
      while (j < result.length && result[j].kind === "plain" && /^\s+$/.test(result[j].text)) j++;
      if (j < result.length && result[j].text === "(") {
        result[i] = { text: result[i].text, kind: "func" };
      }
    }
  }

  return result;
}

function renderExampleCode(code: string, itemId: string, label: string) {
  const tokens = tokenizePythonExample(code);
  return (
    <div className="refdoc-example-block">
      <span className="refdoc-example-label">{label}</span>
      <pre className="refdoc-example-code">
        <code>
          {tokens.map((token, index) => (
            <span
              key={`${itemId}-ex-${index}-${token.text.slice(0, 8)}`}
              className={token.kind === "plain" ? undefined : `refdoc-code-${token.kind}`}
            >
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function renderReferenceItem(item: ReferenceItem, locale: LocaleCode, exampleLabel: string) {
  const tags = splitTagBuckets(item, locale);
  const isProperty = item.kind === "property";
  const nameClass = ITEM_NAME_CLASS[item.kind];
  const iconColorClass = ITEM_ICON_CLASS[item.kind] ?? "";

  return (
    <article key={item.id} id={item.id} className={`refdoc-item refdoc-item-${item.kind}`}>
      <header className="refdoc-item-header">
        <h4>
          {ITEM_KIND_ICON[item.kind] ? <i className={`${ITEM_KIND_ICON[item.kind]} refdoc-kind-icon ${iconColorClass}`} aria-hidden="true" /> : null}
          {nameClass ? <code className={nameClass}>{item.name}</code> : item.name}
        </h4>
        {tags.sinceTag ? <span className="refdoc-inline-badge refdoc-level-badge">{tags.sinceTag}</span> : null}
      </header>

      {item.signature ? (
        <pre className="refdoc-signature">
          {renderSignatureCode(item.signature, item)}
        </pre>
      ) : null}

      <p className={`refdoc-description${isProperty ? " refdoc-description-property" : ""}`}>
        {renderInlineCode(pickText(item.description, locale))}
      </p>

      {tags.primary.length > 0 ? (
        <dl className="refdoc-tag-primary-grid">
          {tags.primary.map((tag) => (
            <div key={`${item.id}:${tag.name}`} className="refdoc-tag-primary-row">
              <dt><code>{tag.name}</code></dt>
              <dd>{renderInlineCode(tag.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {tags.secondary.length > 0 ? (
        <dl className="refdoc-tags">
          {tags.secondary.map((tag) => (
            <div key={`${item.id}:${tag.name}`} className="refdoc-tag-row">
              <dt>
                <code>{tag.name}</code>
              </dt>
              <dd>{renderInlineCode(tag.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {item.examples ? renderExampleCode(pickText(item.examples, locale), item.id, exampleLabel) : null}
    </article>
  );
}

function findTagValue(tags: ReferenceTag[] | undefined, locale: LocaleCode, name: string): string | undefined {
  if (!tags) return undefined;
  const tag = tags.find((item) => item.name === name);
  return tag ? pickText(tag.value, locale) : undefined;
}

function renderCompactMethodCard(item: ReferenceItem, locale: LocaleCode, returnsLabel: string, exampleLabel: string) {
  const since = findTagValue(item.tags, locale, "@since");
  const returns = findTagValue(item.tags, locale, "@return");

  return (
    <article key={item.id} id={item.id} className="refdoc-compact-card">
      <div className="refdoc-compact-header">
        <code className={`refdoc-compact-name ${ITEM_NAME_CLASS[item.kind] ?? ""}`}>
          {ITEM_KIND_ICON[item.kind] ? <i className={`${ITEM_KIND_ICON[item.kind]} refdoc-kind-icon ${ITEM_ICON_CLASS[item.kind] ?? ""}`} aria-hidden="true" /> : null}
          {item.name}
        </code>
        {since ? <span className="refdoc-inline-badge refdoc-level-badge">{since}</span> : null}
      </div>
      {item.signature ? (
        <pre className="refdoc-signature refdoc-signature-compact">
          {renderSignatureCode(item.signature, item)}
        </pre>
      ) : null}
      <p className="refdoc-compact-description">{renderInlineCode(pickText(item.description, locale))}</p>
      {returns ? (
        <div className="refdoc-compact-meta">
          <span className="refdoc-compact-meta-label">{returnsLabel}</span>
          <span>{renderInlineCode(returns)}</span>
        </div>
      ) : null}
      {item.examples ? renderExampleCode(pickText(item.examples, locale), item.id, exampleLabel) : null}
    </article>
  );
}

function renderSamuraiSection(section: (typeof apiReferenceDocument.sections)[number], locale: LocaleCode, returnsLabel: string, exampleLabel: string) {
  const actionGroupIndex = section.items.findIndex((item) => item.id === "samurai-action-methods");
  const senseGroupIndex = section.items.findIndex((item) => item.id === "samurai-sense-methods");

  const introItems = section.items.filter((item, index) => {
    if (actionGroupIndex < 0) return true;
    return index < actionGroupIndex;
  });
  const actionGroup = actionGroupIndex >= 0 ? section.items[actionGroupIndex] : null;
  let actionItems: ReferenceItem[] = [];
  if (actionGroupIndex >= 0) {
    const actionSliceEnd = senseGroupIndex >= 0 ? senseGroupIndex : section.items.length;
    actionItems = section.items.slice(actionGroupIndex + 1, actionSliceEnd).filter((item) => item.kind === "method");
  }
  const senseGroup = senseGroupIndex >= 0 ? section.items[senseGroupIndex] : null;
  const senseItems =
    senseGroupIndex >= 0
      ? section.items.slice(senseGroupIndex + 1).filter((item) => item.kind === "method")
      : [];

  return (
    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
      {introItems.length > 0 ? (
        <div className="refdoc-items">
          {introItems.map((item) => renderReferenceItem(item, locale, exampleLabel))}
        </div>
      ) : null}

      {actionGroup ? (
        <section className="refdoc-subsection">
          <div className="refdoc-subsection-header">
            <h4>{actionGroup.name}</h4>
            <div className="refdoc-subsection-tags">
              {splitTagBuckets(actionGroup, locale).secondary.map((tag) => (
                <code key={`${actionGroup.id}-${tag.name}`} className="refdoc-subsection-chip">
                  {tag.value}
                </code>
              ))}
            </div>
          </div>
          <p className="refdoc-subsection-description">{pickText(actionGroup.description, locale)}</p>
          <div className="refdoc-items refdoc-samurai-action-list">
            {actionItems.map((item) => renderReferenceItem(item, locale, exampleLabel))}
          </div>
        </section>
      ) : null}

      {senseGroup ? (
        <section className="refdoc-subsection">
          <div className="refdoc-subsection-header">
            <h4>{senseGroup.name}</h4>
            <div className="refdoc-subsection-tags">
              {splitTagBuckets(senseGroup, locale).secondary.map((tag) => (
                <code key={`${senseGroup.id}-${tag.name}`} className="refdoc-subsection-chip">
                  {tag.value}
                </code>
              ))}
            </div>
          </div>
          <p className="refdoc-subsection-description">{pickText(senseGroup.description, locale)}</p>
          <div className="refdoc-samurai-sense-grid">
            {senseItems.map((item) => renderCompactMethodCard(item, locale, returnsLabel, exampleLabel))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function renderEntitySection(section: (typeof apiReferenceDocument.sections)[number], locale: LocaleCode, exampleLabel: string) {
  const classItem = section.items.find((item) => item.kind === "class");
  const propertyItems = section.items.filter((item) => item.kind === "property");
  const otherItems = section.items.filter((item) => item.kind !== "class" && item.kind !== "property");

  return (
    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
      <article className="refdoc-entity-card">
        {classItem ? (
          <>
            <header id={classItem.id} className="refdoc-class-focus-header">
              <h4>
                {ITEM_KIND_ICON[classItem.kind] ? <i className={`${ITEM_KIND_ICON[classItem.kind]} refdoc-kind-icon ${ITEM_ICON_CLASS[classItem.kind] ?? ""}`} aria-hidden="true" /> : null}
                <code className={ITEM_NAME_CLASS[classItem.kind] ?? ""}>{classItem.name}</code>
              </h4>
            </header>
            {classItem.signature ? (
              <pre className="refdoc-signature">{renderSignatureCode(classItem.signature, classItem)}</pre>
            ) : null}
            <p className="refdoc-description">{renderInlineCode(pickText(classItem.description, locale))}</p>
          </>
        ) : null}

        {propertyItems.length > 0 ? (
          <div className="refdoc-entity-properties">
            {propertyItems.map((item) => {
              const tags = splitTagBuckets(item, locale);
              return (
                <section key={item.id} id={item.id} className="refdoc-entity-property-row">
                  <div className="refdoc-entity-property-head">
                    <code className={ITEM_NAME_CLASS[item.kind] ?? ""}>{ITEM_KIND_ICON[item.kind] ? <i className={`${ITEM_KIND_ICON[item.kind]} refdoc-kind-icon ${ITEM_ICON_CLASS[item.kind] ?? ""}`} aria-hidden="true" /> : null}{item.name}</code>
                    {tags.sinceTag ? <span className="refdoc-inline-badge refdoc-level-badge">{tags.sinceTag}</span> : null}
                  </div>
                  {item.signature ? (
                    <pre className="refdoc-signature refdoc-signature-compact">
                      {renderSignatureCode(item.signature, item)}
                    </pre>
                  ) : null}
                  <p className="refdoc-compact-description">{renderInlineCode(pickText(item.description, locale))}</p>
                  {tags.secondary.length > 0 ? (
                    <dl className="refdoc-tags">
                      {tags.secondary.map((tag) => (
                        <div key={`${item.id}:${tag.name}`} className="refdoc-tag-row">
                          <dt><code>{tag.name}</code></dt>
                          <dd>{renderInlineCode(tag.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {item.examples ? renderExampleCode(pickText(item.examples, locale), item.id, exampleLabel) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </article>

      {otherItems.length > 0 ? (
        <div className="refdoc-items">
          {otherItems.map((item) => renderReferenceItem(item, locale, exampleLabel))}
        </div>
      ) : null}
    </section>
  );
}

const APP_HEADER_LOGO_SRC = assetUrl("/assets/brand/title-logo.png");

export default function ReferencePage() {
  const { t, i18n } = useTranslation();
  const locale = useMemo(
    () => resolveLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );

  const returnsLabel = t("reference.returns");
  const exampleLabel = t("reference.example");

  const navGroups = useMemo<NavGroup[]>(() => {
    const enumSections = apiReferenceDocument.sections.filter((section) => section.items.some((item) => item.kind === "enum"));
    const classSections = apiReferenceDocument.sections.filter((section) => section.items.some((item) => item.kind === "class"));

    return [
      {
        id: "conventions-nav",
        title: pickText(apiReferenceDocument.conventionsTitle, locale),
        links: [{ href: "#conventions", label: pickText(apiReferenceDocument.conventionsTitle, locale) }],
      },
      {
        id: "enums-nav",
        title: t("reference.sidebarEnums"),
        links: enumSections.map((section) => ({
          href: `#${section.id}`,
          label: section.items.find((item) => item.kind === "enum")?.name ?? pickText(section.title, locale),
        })),
      },
      {
        id: "classes-nav",
        title: t("reference.sidebarClasses"),
        links: classSections.map((section) => {
          const className = section.items.find((item) => item.kind === "class")?.name ?? pickText(section.title, locale);
          const children = section.items
            .filter((item) => item.kind === "method" || item.kind === "property")
            .map((item) => ({
              href: `#${item.id}`,
              label: item.kind === "method" ? `${item.name}()` : item.name,
            }));
          return { href: `#${section.id}`, label: className, children };
        }),
      },
      {
        id: "stdlib-nav",
        title: t("reference.sidebarStdlib"),
        links: stdlibModules.map((entry) => ({
          href: `#stdlib-${entry.module}`,
          label: entry.module,
        })),
      },
    ].filter((group) => group.links.length > 0);
  }, [locale, t]);

  return (
    <>
    <div className="refdoc-page">
      <header className="refdoc-topbar">
        <div className="refdoc-topbar-inner">
          <a className="refdoc-topbar-brand" href="/">
            <img className="refdoc-topbar-logo" src={APP_HEADER_LOGO_SRC} alt={t("app.title")} />
            <span className="refdoc-topbar-title">{t("reference.pageTitle")}</span>
          </a>
        </div>
      </header>

      <div className="refdoc-shell">
        <aside className="refdoc-sidebar" aria-label="Reference navigation">
          <div className="refdoc-sidebar-inner">
            {navGroups.map((group) => (
              <section key={group.id} className="refdoc-nav-group">
                <h2>{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                      {link.children && link.children.length > 0 ? (
                        <ul className="refdoc-nav-children">
                          {link.children.map((child) => (
                            <li key={child.href}>
                              <a href={child.href}>{child.label}</a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>

        <section className="refdoc-layout" aria-label="API reference main">
          <div className="refdoc-main-scroll">
            <section id="conventions" className="refdoc-panel">
              <h2>{pickText(apiReferenceDocument.conventionsTitle, locale)}</h2>
              <ul className="refdoc-list">
                {apiReferenceDocument.conventions.map((line) => (
                  <li key={line.ja}>{renderInlineCode(pickText(line, locale))}</li>
                ))}
              </ul>
            </section>

            <section className="refdoc-panel refdoc-overview-panel">
              <h2>{t("reference.contents")}</h2>
              <nav aria-label="Reference contents">
                <ul className="refdoc-contents">
                  {apiReferenceDocument.sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`}>{pickText(section.title, locale)}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            </section>

            <section className="refdoc-section-block">
              <div className="refdoc-section-heading">
                <h2>{t("reference.enumerations")}</h2>
              </div>
              <div className="refdoc-section-stack">
                {apiReferenceDocument.sections
                  .filter((section) => section.items.some((item) => item.kind === "enum"))
                  .map((section) => (
                    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
                      <div className="refdoc-items">
                        {section.items.map((item) => renderReferenceItem(item, locale, exampleLabel))}
                      </div>
                    </section>
                  ))}
              </div>
            </section>

            <section className="refdoc-section-block">
              <div className="refdoc-section-heading">
                <h2>{t("reference.classes")}</h2>
              </div>
              <div className="refdoc-section-stack">
                {apiReferenceDocument.sections
                  .filter((section) => section.items.some((item) => item.kind === "class"))
                  .map((section) => {
                    if (section.id === "samurai-class") {
                      return renderSamuraiSection(section, locale, returnsLabel, exampleLabel);
                    }
                    if (section.id === "space-class" || section.id === "occupant-class") {
                      return renderEntitySection(section, locale, exampleLabel);
                    }
                    return (
                      <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
                        <div className="refdoc-items">
                          {section.items.map((item) => renderReferenceItem(item, locale, exampleLabel))}
                        </div>
                      </section>
                    );
                  })}
              </div>
            </section>

            <section className="refdoc-section-block">
              <div className="refdoc-section-heading">
                <h2>{t("reference.stdlib")}</h2>
              </div>
              <div className="refdoc-section-stack">
                {stdlibModules.map((entry) => (
                  <section key={entry.module} id={`stdlib-${entry.module}`} className="refdoc-panel refdoc-section">
                    <h3 className="refdoc-section-title">{entry.module}</h3>
                    <p className="refdoc-description">
                      {renderInlineCode(pickText(entry.description, locale))}
                    </p>
                    {entry.examples ? renderExampleCode(pickText(entry.examples, locale), `stdlib-${entry.module}`, exampleLabel) : null}
                    <p className="refdoc-stdlib-link">
                      <a href={entry.url} target="_blank" rel="noopener noreferrer">
                        {t("reference.stdlibOfficialDocs")} ↗
                      </a>
                    </p>
                  </section>
                ))}
              </div>
            </section>

          </div>
        </section>
      </div>
    </div>
    <AppFooter />
    </>
  );
}
