# コード要素の装飾仕様

> API Outline（ゲーム画面）と API Reference（リファレンスページ）で
> コードとして登場する要素に適用する装飾ルールを定義する。
> 両コンポーネントは同じ kind ベースの色体系を共有し、
> 同じ概念には同じ装飾を適用する。

---

## 1. 基本原則

### 1.1 フォント

**コードフォント** (`var(--code-font-family)`) を適用する対象:

- プログラム上の識別子（クラス名、メソッド名、プロパティ名、Enum型名、Enum値）
- シグネチャ（`self`, パラメータ名, 型注釈, 区切り記号）

**UIフォント** （コードフォント不適用）:

- セクション見出し（"API Outline", "API Reference" 等のUIラベル）
- 説明文、ツールチップテキスト
- グループラベル（"Actions", "Senses" 等の分類名）

### 1.2 色の3要素

コード要素の色は以下の3層で構成する:

| 層 | 用途 | 例 |
|----|------|-----|
| **名前色** | 識別子テキストの `color` | `walk` を緑で表示 |
| **アイコン色** | Bootstrap Icon の `color` | ⚙ を緑で表示 |
| **レール色** | 左ボーダー (`border-left`) | 行の左端に薄い緑線（Outline のみ） |

3層とも **kind** に基づいて決定する（レイアウトやレンダリングパスに依存しない）。

### 1.3 kind の定義

| kind | 意味 | 例 |
|------|------|-----|
| `method` | 行動・振る舞い | `walk()`, `attack()`, `feel()` |
| `property` | データ属性 | `hp`, `kind`, `is_empty()` |
| `enum` | 列挙型の値 | `Direction.FORWARD`, `Terrain.WALL` |
| `class` | クラス定義 | `Samurai`, `Space`, `Direction` |
| `group` | 論理グループ（UIラベル、色なし） | "Actions", "Senses" |

### 1.4 2層構造

両コンポーネントに共通する概念的階層:

| 層 | 役割 | 含まれる kind |
|----|------|-------------|
| **L1（型定義）** | クラスやEnum型の宣言 | `class`, `enum`（型として） |
| **L2（メンバー）** | 型に属するメンバー | `method`, `property`, `enum`（値として） |

> **Note**: `enum` kind は文脈によりL1（型: Direction）にもL2（値: FORWARD）にもなる。
> API Outline ではL1=型ヘッダー / L2=値リスト。
> API Reference ではEnum型アイテム自体がEnum値の説明を内包する（L2を個別表示しない）。

---

## 2. kind ごとの装飾仕様（あるべき姿）

### 2.1 共有CSS変数

`:root` に定義し、全コンポーネントが参照する:

```css
--kind-method-fg:   var(--pal-green);   /* 緑 — 行動/振る舞い */
--kind-property-fg: var(--pal-blue);    /* 青 — データ属性 */
--kind-enum-fg:     var(--pal-aqua);    /* 水色 — 列挙値 */
```

### 2.2 L2 メンバーの装飾

L2 メンバーは kind ごとに明確な色を持つ。
両コンポーネントで同じ `--kind-*-fg` を参照すること。

| kind | アイコン | アイコン色 | 名前色 | フォント |
|------|---------|-----------|-------|---------|
| `method` | `bi-gear-fill` | `--kind-method-fg` | `--kind-method-fg` | code |
| `property` | `bi-key-fill` | `--kind-property-fg` | `--kind-property-fg` | code |
| `enum`（値） | `bi-key-fill` | `--kind-enum-fg` | `--kind-enum-fg` | code |

### 2.3 L1 型定義の装飾

L1 は **構造（太字 + アイコン + 位置）** で視覚的に区別される層であり、
kind 色による色分けは行わない。色は `--pal-fg`（テキスト色）に統一する。

| kind | アイコン | アイコン色 | 名前色 | font-weight | フォント |
|------|---------|-----------|-------|-------------|---------|
| `class` | `bi-box-fill` | `--pal-fg` | `--pal-fg` | 700 | code |
| `enum`（型） | `bi-list-columns-reverse` | `--pal-fg` | `--pal-fg` | 700 | code |

L1 に kind 色を使わない理由:
- 太字化とアイコンで十分に識別可能
- L2 メンバーや見出しに挟まれる位置にあり、テキスト色でも十分に目立つ
- kind 色を L2 に限定することで、色の意味（= メンバーの種別）が明確になる

### 2.4 group の装飾

`group` はコード識別子ではないためUIフォントを使用し、kind色を適用しない。

---

## 3. コンポーネント実装の比較

### 3.1 対照表: L2 メンバー

| 装飾 | kind | API Outline | API Reference | 一致 |
|------|------|-------------|---------------|------|
| **アイコン** | method | `bi-gear-fill` | `bi-gear-fill` | ✅ |
| | property | `bi-key-fill` | `bi-key-fill` | ✅ |
| | enum値 | `bi-key-fill` | *(個別表示なし)* | — |
| **アイコン色** | method | `--kind-method-fg` | `--kind-method-fg` | ✅ |
| | property | `--kind-property-fg` | `--kind-property-fg` | ✅ |
| | enum値 | `--kind-enum-fg` | *(個別表示なし)* | — |
| **名前色** | method | `--kind-method-fg` | `--kind-method-fg` | ✅ |
| | property | `--kind-property-fg` | `--kind-property-fg` | ✅ |
| | enum値 | ⚠ `--kind-property-fg` | *(個別表示なし)* | **BUG** |
| **名前フォント** | method | code (継承) | code (`<code>`) | ✅ |
| | property | code (継承) | code (`<code>`) | ✅ |
| | enum値 | code (継承) | *(個別表示なし)* | — |
| **レール** | method | `--api-tree-method-rail` | *(なし)* | — |
| | property | `--api-tree-property-rail` | *(なし)* | — |
| | enum値 | ⚠ `--api-tree-property-rail` | *(なし)* | **BUG** |

### 3.2 対照表: L1 型定義

仕様: L1 は `--pal-fg` に統一（§2.3）。

| 装飾 | kind | API Outline | API Reference | 一致 |
|------|------|-------------|---------------|------|
| **アイコン** | class | `bi-box-fill` | `bi-box-fill` | ✅ |
| | enum型 | `bi-list-columns-reverse` | `bi-list-columns-reverse` | ✅ |
| **アイコン色** | class | `--pal-fg` (row-class 継承) | `--pal-fg` (refdoc-kind-icon--class) | ✅ |
| | enum型 | `--pal-fg` (row-class 継承) | `--kind-enum-fg` ※1 | △ |
| **名前色** | class | `--pal-fg` | `--pal-fg` (refdoc-name--class) | ✅ |
| | enum型 | `--pal-fg` | `--kind-enum-fg` ※1 | △ |
| **名前フォント** | class | code (継承) | code (`<code>`) | ✅ |
| | enum型 | code (継承) | code (`<code>`) | ✅ |

**※1**: Reference ではEnum型アイテム（Direction, Terrain）を `renderReferenceItem` で描画し、
kind="enum" として `--kind-enum-fg` を適用する。Enum型はReferenceではL1とL2の区別がなく
（型アイテム自体が値の説明を内包する）、L2色の適用は妥当。

### 3.3 レンダリングパスの整理（API Reference 内部）

API Reference は内部に3つのレンダリングパスを持つ。
全パスが `ITEM_NAME_CLASS` / `ITEM_ICON_CLASS` マップ経由で kind 解決する:

| パス | 使用箇所 | 処理する kind |
|------|---------|-------------|
| `renderReferenceItem` | Enum セクション全体, Samurai introItems, fallback | **全 kind** |
| `renderCompactMethodCard` | Samurai sense methods | method のみ |
| `renderEntitySection` | Space, Occupant | class + property |

---

## 4. 修正履歴

以下は設計原則違反として検出・修正された不整合の記録。

### 4.1 [Outline] Enum値の名前色 — L2 ✅ 修正済

**違反原則**: P5 (ハードコード) + P2 (網羅性)

**問題**: `renderApiStructureSignature("enum-member", ...)` が
`api-structure-sig-name-property` をハードコード → property 色で表示。

**修正**: `.api-structure-sig-name-enum` を追加し、enum-member 分岐で使用。

### 4.2 [Outline] Enum値のレール色 — L2 ✅ 修正済

**違反原則**: P2 (網羅性)

**問題**: `--api-tree-enum-rail` 変数が未定義のため property-rail を流用。

**修正**: `--api-tree-enum-rail` を全テーマブロックに追加。

### 4.3 [Reference] クラス名にコードフォント・アイコンがない — L1 ✅ 修正済

**違反原則**: P2 (網羅性) + P4 (フォント継承) + P5 (ハードコード)

**問題**: `ITEM_NAME_CLASS` / `ITEM_ICON_CLASS` に "class" 未登録。
`renderEntitySection` がマップをバイパスして `<h4>` 素テキスト。

**修正**: 両マップに class エントリ追加。CSS に `.refdoc-name--class`
/ `.refdoc-kind-icon--class` 追加（色は `--pal-fg`）。
`renderEntitySection` をマップ経由の解決に変更。

### 4.4 [Outline] L1ヘッダーの色統一 ✅ 修正済

**問題**: L1 ヘッダーが `--pal-green` で着色 → method と同色。
アイコンも `--api-tree-icon`（別変数）で色が不統一。

**修正**: `--api-tree-class-row-text` を `--pal-fg` に変更。
`.api-structure-class-icon` の明示的 color を除去し row-class から継承。

---

## 5. テーマ別カラーテーブル

### 5.1 Everforest Dark（デフォルト）

| CSS変数 | パレット | HEX |
|---------|---------|-----|
| `--kind-method-fg` | `--pal-green` | `#a7c080` |
| `--kind-property-fg` | `--pal-blue` | `#7fbbb3` |
| `--kind-enum-fg` | `--pal-aqua` | `#83c092` |

### 5.2 Everforest Light

| CSS変数 | パレット | HEX |
|---------|---------|-----|
| `--kind-method-fg` | `--pal-green` | `#8da101` |
| `--kind-property-fg` | `--pal-blue` | `#3a94c5` |
| `--kind-enum-fg` | `--pal-aqua` | `#35a77c` |

### 5.3 Rose Pine Dark / Light

Rose Pine ではパレット上 `--pal-green` = `--pal-blue` (`#9ccfd8` / `#56949f`) のため、
property と enum はパレット変数をオーバーライドして視覚的区別を確保する:

| CSS変数 | パレット | Dark HEX | Light HEX |
|---------|---------|----------|-----------|
| `--kind-method-fg` | `--pal-green` | `#9ccfd8` | `#56949f` |
| `--kind-property-fg` | **`--pal-purple`** | `#c4a7e7` | `#907aa9` |
| `--kind-enum-fg` | **`--pal-orange`** | `#f6c177` | `#ea9d34` |

---

## 6. CSS設計アーキテクチャ

### 6.1 設計原則

#### P1: 基底クラスと修飾クラスの分離

CSSクラスは **基底（レイアウト）** と **修飾（装飾）** に分離する。

- **基底クラス**: サイジング、配置、余白のみ。色を持たない。
- **修飾クラス**: kind に基づく色のみ。レイアウトを持たない。

```
基底:  .api-structure-item-icon    → width, flex, display（色なし）
修飾:  .api-structure-item-icon-method → color: var(--kind-method-fg)（サイズなし）

基底:  .refdoc-kind-icon           → margin, font-size（色なし）
修飾:  .refdoc-kind-icon--method   → color: var(--kind-method-fg)（サイズなし）
```

JSXでは必ず `基底 + 修飾` を組み合わせる:
```tsx
className={`api-structure-item-icon api-structure-item-icon-${kind}`}
className={`refdoc-kind-icon ${ITEM_ICON_CLASS[kind]}`}
```

#### P2: kind 修飾クラスの網羅性

UIに出現する **全ての kind に対して、対応する修飾クラスが存在しなければならない。**

各コンポーネントの修飾クラスセット:

| 装飾対象 | method | property | enum | class |
|---------|--------|----------|------|-------|
| **Outline アイコン** `item-icon-{kind}` | ✅ | ✅ | ✅ | — (L1は row-class 継承) |
| **Outline 名前** `sig-name-{kind}` | ✅ | ✅ | ✅ | — |
| **Outline レール** `row-leaf-{kind}` + 変数 | ✅ | ✅ | ✅ | — |
| **Reference 名前** `name--{kind}` | ✅ | ✅ | ✅ | ✅ |
| **Reference アイコン** `kind-icon--{kind}` | ✅ | ✅ | ✅ | ✅ |

> kind が追加・表示される場合は、このテーブルの全行に ✅ が揃うまで
> 対応する修飾クラスと変数を追加すること。

#### P3: 命名規則

| コンポーネント | パターン | 例 |
|---------------|---------|-----|
| Outline | `api-structure-{要素}-{kind}` | `api-structure-sig-name-method` |
| Reference | `refdoc-{要素}--{kind}` | `refdoc-name--method` |

kind 部分は `method` / `property` / `enum` / `class` のいずれか。
新しい kind が追加された場合、両コンポーネントにクラスを追加する。

#### P4: フォントの継承戦略

コードフォントの適用方法はコンポーネントの構造に合わせる:

| コンポーネント | 方式 | 理由 |
|---------------|------|------|
| **Outline** | 祖先要素 `.api-structure-tree` に `font-family` を設定し、全子孫が継承 | ツリー内は全てコード要素 |
| **Reference** | 各識別子を `<code>` 要素でラップ | 散文（説明文）とコード要素が混在 |

**制約**: Reference で識別子を表示する箇所は、kind に関わらず `<code>` でラップすること。
`ITEM_NAME_CLASS[kind]` が定義されていれば `<code className={...}>` で適用される。
未定義の kind があると素テキスト（= UIフォント）にフォールバックし、P2違反となる。

#### P5: レンダリングコードでの kind 解決

レンダリングコード（JSX）は **kind → CSSクラスの解決を一元化されたマップ経由で行う。**
クラス名をハードコードしない。

```
✅ 正: ITEM_ICON_CLASS[item.kind]         → マップで解決
✅ 正: `api-structure-item-icon-${kind}`   → テンプレートリテラルで kind を埋める
❌ 誤: "api-structure-sig-name-property"   → 直接ハードコード（kind に依存しない）
```

> ハードコードは kind の変更・追加時に追従漏れを引き起こす。

#### P6: CSS変数の参照チェーン

色の参照は以下の層を順に辿り、**層をスキップしない**:

```
コンポーネント層（CSSクラス）
  ↓ 参照
kind セマンティック層（--kind-*-fg 変数）
  ↓ 参照
パレット層（--pal-* 変数、テーマごとに再定義）
```

**禁止**: コンポーネント層がパレットを直接参照する（例: `color: var(--pal-green)`）。
テーマ変更時に kind セマンティック層のオーバーライドが効かなくなる。

### 6.2 CSS変数の階層

```
:root
├── パレット層（テーマごとに再定義）
│   ├── --pal-green, --pal-blue, --pal-aqua, --pal-purple, --pal-orange
│   └── --pal-*-rgb（RGBA用）
│
├── kind セマンティック層（パレットを参照、テーマで必要時のみオーバーライド）
│   ├── --kind-method-fg:   var(--pal-green)
│   ├── --kind-property-fg: var(--pal-blue)    ← Rose Pine: var(--pal-purple)
│   └── --kind-enum-fg:     var(--pal-aqua)    ← Rose Pine: var(--pal-orange)
│
├── Outline UI装飾層（ツリー固有、パレットを参照。L1ヘッダー用）
│   ├── --api-tree-class-row-text: var(--pal-green)
│   ├── --api-tree-group-text: var(--pal-blue)
│   ├── --api-tree-method-rail:   rgba(--pal-blue-rgb, 0.16)
│   ├── --api-tree-property-rail: rgba(テーマ依存, 0.16)
│   └── --api-tree-enum-rail:   rgba(--pal-aqua-rgb, 0.16)
│
└── コンポーネント層（修飾クラス。--kind-* のみ参照）
    ├── Outline L2:
    │   ├── .api-structure-item-icon-{kind}  → var(--kind-{kind}-fg)
    │   └── .api-structure-sig-name-{kind}   → var(--kind-{kind}-fg)
    │
    └── Reference:
        ├── .refdoc-name--{kind}             → var(--kind-{kind}-fg)
        └── .refdoc-kind-icon--{kind}        → var(--kind-{kind}-fg)
```

### 6.3 バグパターンの分析（修正済み、教訓として記録）

§4 で修正した全バグの違反原則:

| バグ | 違反原則 | 根本原因 |
|------|---------|---------|
| **4.1** Enum値の名前色 | **P5** + **P2** | ハードコード + `sig-name-enum` 未実装 |
| **4.2** Enum値のレール色 | **P2** | `--api-tree-enum-rail` 未実装 |
| **4.3** クラスのフォント/アイコン | **P2** + **P4** + **P5** | マップ未登録 + Entity パスがマップをバイパス |
| **4.4** L1ヘッダーの色 | *(設計不在)* | L1 の色仕様が未定義だった |

> **共通パターン**: 全バグが P2（網羅性）違反を含んでいた。
> kind に対応するクラス/変数が存在しないため、別 kind のものを流用する
> 対症療法が発生し、不整合が連鎖的に拡大した。
>
> **予防策**: 新しい kind がUIに追加される際は、P2 の網羅性チェック表（§6.1）を
> 確認し、全修飾クラスと変数を同時に追加すること。

---

## 7. コンポーネント別の実装詳細

### 7.1 API Outline（ゲーム画面のツリー）

```
.api-structure-tree          ← font-family: var(--code-font-family)
│                               ツリー全体にコードフォントを継承
│
├── L1: クラス/Enum型ヘッダー (.api-structure-row-class)
│   ├── twistie (▾)          ← 装飾なし
│   ├── class-icon           ← color: var(--api-tree-icon) テーマ装飾色
│   └── label                ← color: var(--api-tree-class-row-text), bold 700
│                               コードフォントは .api-structure-tree から継承
│
├── L1: グループヘッダー (.api-structure-row-group)
│   └── label                ← color: var(--api-tree-group-text), bold 600
│                               ※ グループ名はUIラベル（コードではない）
│
└── L2: リーフノード (.api-structure-row-leaf)
    ├── item-icon            ← color: --kind-{kind}-fg
    ├── rail (border-left)   ← --api-tree-{kind}-rail
    └── signature            ← コードフォントは .api-structure-tree から継承
        ├── sig-name-method   → color: --kind-method-fg
        ├── sig-name-property → color: --kind-property-fg
        ├── sig-name-enum     → color: --kind-enum-fg
        ├── sig-self          → bold, --syntax-keyword
        ├── sig-type          → --syntax-variable
        └── sig-punct         → --syntax-punctuation
```

### 7.2 API Reference（リファレンスページ）

#### 定数マップ（kind → CSSクラス解決）

```typescript
const ITEM_NAME_CLASS = {
  method: "refdoc-name--method",
  property: "refdoc-name--property",
  enum: "refdoc-name--enum",
  class: "refdoc-name--class",
};

const ITEM_ICON_CLASS = {
  method: "refdoc-kind-icon--method",
  property: "refdoc-kind-icon--property",
  enum: "refdoc-kind-icon--enum",
  class: "refdoc-kind-icon--class",
};
```

#### レンダリングパスと担当

| パス | 使用箇所 | 処理する kind |
|------|---------|-------------|
| `renderReferenceItem` | Enum セクション全体, Samurai introItems, fallback | **全 kind** |
| `renderCompactMethodCard` | Samurai sense methods | method のみ |
| `renderSamuraiSection` | Samurai クラス全体の構成 | 内部で上記2つを呼ぶ |
| `renderEntitySection` | Space, Occupant | class + property |

#### 各パスの装飾適用

**`renderReferenceItem`** — 汎用パス:
- アイコン: `ITEM_KIND_ICON[kind]` → Bootstrap Icon、色は `ITEM_ICON_CLASS[kind]`
- 名前: `ITEM_NAME_CLASS[kind]` → `<code>` でラップ、kind色

**`renderCompactMethodCard`** — sense method 専用:
- アイコン: `ITEM_KIND_ICON[kind]` + `ITEM_ICON_CLASS[kind]`
- 名前: `refdoc-compact-name` + `ITEM_NAME_CLASS[kind]`

**`renderEntitySection`** — Space/Occupant 専用:
- L1（class）: マップ経由で `<code>` + アイコン + 色クラス適用
- L2（property）: マップ経由で `ITEM_NAME_CLASS[kind]` + `ITEM_ICON_CLASS[kind]`
