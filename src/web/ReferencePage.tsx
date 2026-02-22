import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  apiReferenceDocument,
  pickText,
  type LocaleCode,
  type ReferenceItem,
  type ReferenceTag,
} from "./reference/reference-data";

function resolveLocale(language?: string): LocaleCode {
  return language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

function itemTypeLabel(item: ReferenceItem): string {
  switch (item.kind) {
    case "enum":
      return "ENUM";
    case "class":
      return "CLASS";
    case "method":
      return "METHOD";
    case "property":
      return "PROPERTY";
    case "group":
      return "GROUP";
    default:
      return "ITEM";
  }
}

interface NavGroup {
  id: string;
  title: string;
  links: Array<{ href: string; label: string }>;
}

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
  typeTag?: string;
  sinceTag?: string;
  values: string[];
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
    values: [],
    primary: [],
    secondary: [],
  };

  for (const tag of localized) {
    if (tag.name === "@type") {
      buckets.typeTag = tag.value;
      continue;
    }
    if (tag.name === "@since") {
      buckets.sinceTag = tag.value;
      continue;
    }
    if (tag.name === "@values") {
      buckets.values = tag.value.split("|").map((value) => value.trim()).filter(Boolean);
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

function renderReferenceItem(item: ReferenceItem, locale: LocaleCode) {
  const tags = splitTagBuckets(item, locale);
  const isProperty = item.kind === "property";
  const isEnum = item.kind === "enum";

  return (
    <article key={item.id} id={item.id} className={`refdoc-item refdoc-item-${item.kind}`}>
      <header className="refdoc-item-header">
        <div>
          <p className="refdoc-item-kind">{itemTypeLabel(item)}</p>
          <div className="refdoc-item-title-row">
            <h4>
              {item.owner ? <span className="refdoc-owner">{item.owner}.</span> : null}
              {item.name}
            </h4>
            {tags.typeTag ? <span className="refdoc-inline-badge">{tags.typeTag}</span> : null}
            {tags.sinceTag ? <span className="refdoc-inline-badge refdoc-level-badge">{tags.sinceTag}</span> : null}
          </div>
        </div>
        <a className="refdoc-anchor" href={`#${item.id}`} aria-label={`#${item.id}`}>
          #
        </a>
      </header>

      {item.signature ? (
        <pre className="refdoc-signature">
          {renderSignatureCode(item.signature, item)}
        </pre>
      ) : null}

      <p className={`refdoc-description${isProperty ? " refdoc-description-property" : ""}`}>
        {pickText(item.description, locale)}
      </p>

      {isEnum && tags.values.length > 0 ? (
        <div className="refdoc-enum-values" aria-label="Enum values">
          {tags.values.map((value) => (
            <code key={`${item.id}-value-${value}`} className="refdoc-enum-chip">{value}</code>
          ))}
        </div>
      ) : null}

      {tags.primary.length > 0 ? (
        <dl className="refdoc-tag-primary-grid">
          {tags.primary.map((tag) => (
            <div key={`${item.id}:${tag.name}`} className="refdoc-tag-primary-row">
              <dt><code>{tag.name}</code></dt>
              <dd>{tag.value}</dd>
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
              <dd>{tag.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function findTagValue(tags: ReferenceTag[] | undefined, locale: LocaleCode, name: string): string | undefined {
  if (!tags) return undefined;
  const tag = tags.find((item) => item.name === name);
  return tag ? pickText(tag.value, locale) : undefined;
}

function renderCompactMethodCard(item: ReferenceItem, locale: LocaleCode) {
  const since = findTagValue(item.tags, locale, "@since");
  const returns = findTagValue(item.tags, locale, "@return");

  return (
    <article key={item.id} id={item.id} className="refdoc-compact-card">
      <div className="refdoc-compact-header">
        <code className="refdoc-compact-name">{item.name}</code>
        {since ? <span className="refdoc-inline-badge refdoc-level-badge">{since}</span> : null}
      </div>
      {item.signature ? (
        <pre className="refdoc-signature refdoc-signature-compact">
          {renderSignatureCode(item.signature, item)}
        </pre>
      ) : null}
      <p className="refdoc-compact-description">{pickText(item.description, locale)}</p>
      {returns ? (
        <div className="refdoc-compact-meta">
          <span className="refdoc-compact-meta-label">Returns</span>
          <span>{returns}</span>
        </div>
      ) : null}
    </article>
  );
}

function renderSamuraiSection(section: (typeof apiReferenceDocument.sections)[number], locale: LocaleCode) {
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
      <h3 className="refdoc-section-title">{pickText(section.title, locale)}</h3>
      {section.intro ? <p className="refdoc-intro">{pickText(section.intro, locale)}</p> : null}

      {introItems.length > 0 ? (
        <div className="refdoc-items">
          {introItems.map((item) => renderReferenceItem(item, locale))}
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
            {actionItems.map((item) => renderReferenceItem(item, locale))}
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
            {senseItems.map((item) => renderCompactMethodCard(item, locale))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function renderPlayerSection(section: (typeof apiReferenceDocument.sections)[number], locale: LocaleCode) {
  const classItem = section.items.find((item) => item.kind === "class");
  const methodItems = section.items.filter((item) => item.kind === "method");
  const extraItems = section.items.filter((item) => item.kind !== "class" && item.kind !== "method");

  return (
    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
      <h3 className="refdoc-section-title">{pickText(section.title, locale)}</h3>
      {section.intro ? <p className="refdoc-intro">{pickText(section.intro, locale)}</p> : null}

      {classItem ? (
        <article id={classItem.id} className="refdoc-class-focus-card">
          <header className="refdoc-class-focus-header">
            <div>
              <p className="refdoc-item-kind">{itemTypeLabel(classItem)}</p>
              <h4>{classItem.name}</h4>
            </div>
            <a className="refdoc-anchor" href={`#${classItem.id}`} aria-label={`#${classItem.id}`}>#</a>
          </header>
          {classItem.signature ? (
            <pre className="refdoc-signature">{renderSignatureCode(classItem.signature, classItem)}</pre>
          ) : null}
          <p className="refdoc-description">{pickText(classItem.description, locale)}</p>
        </article>
      ) : null}

      {methodItems.map((item) => {
        const tags = splitTagBuckets(item, locale);
        return (
          <article key={item.id} id={item.id} className="refdoc-method-focus-card">
            <header className="refdoc-method-focus-header">
              <div className="refdoc-method-focus-title">
                <span className="refdoc-method-focus-badge">{itemTypeLabel(item)}</span>
                <h4>{item.name}</h4>
                {tags.sinceTag ? <span className="refdoc-inline-badge refdoc-level-badge">{tags.sinceTag}</span> : null}
              </div>
              <a className="refdoc-anchor" href={`#${item.id}`} aria-label={`#${item.id}`}>#</a>
            </header>
            {item.signature ? (
              <pre className="refdoc-signature">{renderSignatureCode(item.signature, item)}</pre>
            ) : null}
            <p className="refdoc-description">{pickText(item.description, locale)}</p>
            {tags.primary.length > 0 ? (
              <dl className="refdoc-tag-primary-grid">
                {tags.primary.map((tag) => (
                  <div key={`${item.id}:${tag.name}`} className="refdoc-tag-primary-row">
                    <dt><code>{tag.name}</code></dt>
                    <dd>{tag.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {tags.secondary.length > 0 ? (
              <dl className="refdoc-tags">
                {tags.secondary.map((tag) => (
                  <div key={`${item.id}:${tag.name}`} className="refdoc-tag-row">
                    <dt><code>{tag.name}</code></dt>
                    <dd>{tag.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </article>
        );
      })}

      {extraItems.length > 0 ? (
        <div className="refdoc-items">
          {extraItems.map((item) => renderReferenceItem(item, locale))}
        </div>
      ) : null}
    </section>
  );
}

function renderEntitySection(section: (typeof apiReferenceDocument.sections)[number], locale: LocaleCode) {
  const classItem = section.items.find((item) => item.kind === "class");
  const propertyItems = section.items.filter((item) => item.kind === "property");
  const otherItems = section.items.filter((item) => item.kind !== "class" && item.kind !== "property");

  return (
    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
      <h3 className="refdoc-section-title">{pickText(section.title, locale)}</h3>
      {section.intro ? <p className="refdoc-intro">{pickText(section.intro, locale)}</p> : null}

      <article className="refdoc-entity-card">
        {classItem ? (
          <>
            <header id={classItem.id} className="refdoc-class-focus-header">
              <div>
                <p className="refdoc-item-kind">{itemTypeLabel(classItem)}</p>
                <h4>{classItem.name}</h4>
              </div>
              <a className="refdoc-anchor" href={`#${classItem.id}`} aria-label={`#${classItem.id}`}>#</a>
            </header>
            {classItem.signature ? (
              <pre className="refdoc-signature">{renderSignatureCode(classItem.signature, classItem)}</pre>
            ) : null}
            <p className="refdoc-description">{pickText(classItem.description, locale)}</p>
          </>
        ) : null}

        {propertyItems.length > 0 ? (
          <div className="refdoc-entity-properties">
            {propertyItems.map((item) => {
              const tags = splitTagBuckets(item, locale);
              return (
                <section key={item.id} id={item.id} className="refdoc-entity-property-row">
                  <div className="refdoc-entity-property-head">
                    <div className="refdoc-entity-property-title">
                      <code className="refdoc-entity-property-name">{item.name}</code>
                      {tags.typeTag ? <span className="refdoc-inline-badge">{tags.typeTag}</span> : null}
                      {tags.sinceTag ? <span className="refdoc-inline-badge refdoc-level-badge">{tags.sinceTag}</span> : null}
                    </div>
                    <a className="refdoc-anchor" href={`#${item.id}`} aria-label={`#${item.id}`}>#</a>
                  </div>
                  {item.signature ? (
                    <pre className="refdoc-signature refdoc-signature-compact">
                      {renderSignatureCode(item.signature, item)}
                    </pre>
                  ) : null}
                  <p className="refdoc-compact-description">{pickText(item.description, locale)}</p>
                  {tags.secondary.length > 0 ? (
                    <dl className="refdoc-tags">
                      {tags.secondary.map((tag) => (
                        <div key={`${item.id}:${tag.name}`} className="refdoc-tag-row">
                          <dt><code>{tag.name}</code></dt>
                          <dd>{tag.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </article>

      {otherItems.length > 0 ? (
        <div className="refdoc-items">
          {otherItems.map((item) => renderReferenceItem(item, locale))}
        </div>
      ) : null}
    </section>
  );
}

export default function ReferencePage() {
  const { i18n } = useTranslation();
  const locale = useMemo(
    () => resolveLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
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
        title: "Enums",
        links: enumSections.map((section) => ({
          href: `#${section.id}`,
          label: section.items.find((item) => item.kind === "enum")?.name ?? pickText(section.title, locale),
        })),
      },
      {
        id: "classes-nav",
        title: "Classes",
        links: classSections.map((section) => ({
          href: `#${section.id}`,
          label: section.items.find((item) => item.kind === "class")?.name ?? pickText(section.title, locale),
        })),
      },
      {
        id: "reference-nav",
        title: "Reference",
        links: [{ href: "#availability", label: pickText(apiReferenceDocument.availabilityTitle, locale) }],
      },
    ].filter((group) => group.links.length > 0);
  }, [locale]);

  return (
    <div className="refdoc-page">
      <header className="refdoc-topbar">
        <div className="refdoc-topbar-inner">
          <div className="refdoc-topbar-brand">
            <span className="refdoc-topbar-logo">Py</span>
            <span className="refdoc-topbar-title">Game API Reference</span>
          </div>
          <nav className="refdoc-topbar-links" aria-label="Reference shortcuts">
            <a className="refdoc-topbar-link" href="#conventions">Conventions</a>
            <a className="refdoc-topbar-link" href="#availability">Availability</a>
            <a className="refdoc-topbar-link refdoc-topbar-cta" href="/">Play Game</a>
          </nav>
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
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>

        <section className="refdoc-layout" aria-label="API reference main">
          <header className="refdoc-hero">
            <div className="refdoc-hero-content">
              <p className="refdoc-kicker">API</p>
              <h1>{apiReferenceDocument.title}</h1>
              <p className="refdoc-subtitle">{pickText(apiReferenceDocument.subtitle, locale)}</p>
            </div>
          </header>

          <div className="refdoc-main-scroll">
            <section id="conventions" className="refdoc-panel">
              <h2>{pickText(apiReferenceDocument.conventionsTitle, locale)}</h2>
              <ul className="refdoc-list">
                {apiReferenceDocument.conventions.map((line) => (
                  <li key={line.ja}>{pickText(line, locale)}</li>
                ))}
              </ul>
            </section>

            <section className="refdoc-panel refdoc-overview-panel">
              <h2>Contents</h2>
              <nav aria-label="Reference contents">
                <ul className="refdoc-contents">
                  {apiReferenceDocument.sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`}>{pickText(section.title, locale)}</a>
                    </li>
                  ))}
                  <li>
                    <a href="#availability">{pickText(apiReferenceDocument.availabilityTitle, locale)}</a>
                  </li>
                </ul>
              </nav>
            </section>

            <section className="refdoc-section-block">
              <div className="refdoc-section-heading">
                <h2>{locale === "ja" ? "Enums" : "Enumerations"}</h2>
              </div>
              <div className="refdoc-section-stack">
                {apiReferenceDocument.sections
                  .filter((section) => section.items.some((item) => item.kind === "enum"))
                  .map((section) => (
                    <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
                      <h3 className="refdoc-section-title">{pickText(section.title, locale)}</h3>
                      <div className="refdoc-items">
                        {section.items.map((item) => renderReferenceItem(item, locale))}
                      </div>
                    </section>
                  ))}
              </div>
            </section>

            <section className="refdoc-section-block">
              <div className="refdoc-section-heading">
                <h2>Classes</h2>
              </div>
              <div className="refdoc-section-stack">
                {apiReferenceDocument.sections
                  .filter((section) => section.items.some((item) => item.kind === "class"))
                  .map((section) => {
                    if (section.id === "samurai-class") {
                      return renderSamuraiSection(section, locale);
                    }
                    if (section.id === "player-class") {
                      return renderPlayerSection(section, locale);
                    }
                    if (section.id === "space-class" || section.id === "occupant-class") {
                      return renderEntitySection(section, locale);
                    }
                    return (
                      <section key={section.id} id={section.id} className="refdoc-panel refdoc-section">
                        <h3 className="refdoc-section-title">{pickText(section.title, locale)}</h3>
                        {section.intro ? <p className="refdoc-intro">{pickText(section.intro, locale)}</p> : null}
                        <div className="refdoc-items">
                          {section.items.map((item) => renderReferenceItem(item, locale))}
                        </div>
                      </section>
                    );
                  })}
              </div>
            </section>

            <section id="availability" className="refdoc-panel refdoc-section">
              <h2>{pickText(apiReferenceDocument.availabilityTitle, locale)}</h2>
              <div className="refdoc-table-wrap">
                <table className="refdoc-table">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>API</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiReferenceDocument.availabilityRows.map((row) => (
                      <tr key={row.level}>
                        <td>{row.level}</td>
                        <td>
                          {row.apis.map((api) => (
                            <code key={`${row.level}-${api}`} className="refdoc-chip">
                              {api}
                            </code>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
