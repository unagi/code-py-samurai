# PySamurai - Implementation Plan

## Context

ruby-warrior (ryanb) をベースに、Python対応のWeb版ゲームを構築する。
ユーザーはPythonでプレイヤーコードを記述し、それがJSに変換されてブラウザ上で動作する。
サーバーサイド不要の完全クライアントサイドアプリケーション。
キャラクターはサムライ猫で、デザインは完全刷新。

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│                                                  │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Code Editor   │  │ Game Renderer           │  │
│  │ (Python入力)  │  │ (Canvas/Sprite Animation)│  │
│  └──────┬───────┘  └────────▲────────────────┘  │
│         │                    │                    │
│         ▼                    │                    │
│  ┌──────────────┐  ┌────────┴────────────────┐  │
│  │ Python→JS    │  │ Game Engine (TypeScript)  │  │
│  │ Transpiler   │──▶│ Units/Abilities/Floor    │  │
│  │ (Skulpt)     │  │ Turn System/Levels       │  │
│  └──────────────┘  └─────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | 型安全、IDE支援、大規模開発向き |
| Build | Vite | 高速HMR、モダンビルドツール |
| UI Framework | React | エコシステム最大、react-i18next成熟、状態管理・画面遷移が容易 |
| Python実行 | Skulpt | 教育向けPython-in-browser、軽量、変換ベース |
| Code Editor | CodeMirror 6 | 軽量、Python syntax対応、React統合可能(@uiw/react-codemirror) |
| Game Rendering | HTML Canvas + Sprite | 2Dタイルベースに最適、依存なし |
| Styling | Tailwind CSS | ユーティリティファースト、迅速なUI構築 |
| i18n | react-i18next | React標準、JSON翻訳ファイル、遅延読み込み対応 |
| Testing | Vitest | Viteネイティブ、高速 |

### Skulpt を選ぶ理由

palkanはRuby WASMを使っているが、我々はPython→JS変換を行う。選択肢:

- **Pyodide** (CPython WASM): ~10MB+と重い。フル機能だが教育用途にはオーバースペック
- **Brython**: Python-in-browser。やや重い
- **Skulpt**: Python→JS変換。軽量(~1MB)、教育用途に設計。CodeCombat等で実績あり
- **カスタムトランスパイラ**: API面が狭いので可能だが、if/for/while/class等の基本構文対応が必要で工数大

**Skulpt推奨**: 軽量、教育用途向け、PythonコードをJSに変換して実行するため要件に合致。

## Project Structure

```
py-samurai/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── assets/
│       ├── sprites/           # キャラクタースプライト
│       │   ├── samurai-cat/   # プレイヤーキャラ
│       │   ├── sludge/        # 敵キャラ
│       │   ├── archer/
│       │   ├── captive/
│       │   └── ...
│       ├── tiles/             # 床、壁、階段タイル
│       └── ui/                # UIアセット
├── src/
│   ├── main.tsx               # Reactエントリポイント
│   ├── web/
│   │   ├── App.tsx            # 画面統合（現行）
│   │   ├── styles.css
│   │   └── components/        # React分割先（今後）
│   │
│   ├── engine/                # ゲームエンジン (ryanb移植)
│   │   ├── game.ts            # Game管理
│   │   ├── tower.ts           # タワー(レベル群)
│   │   ├── level.ts           # レベル定義・実行
│   │   ├── floor.ts           # 2Dグリッド
│   │   ├── space.ts           # グリッドセル
│   │   ├── position.ts        # 座標・方向管理
│   │   ├── turn.ts            # ターン実行
│   │   ├── profile.ts         # プレイヤー進行状態
│   │   ├── scoring.ts         # スコアリング
│   │   ├── abilities/         # アビリティ群
│   │   │   ├── base.ts
│   │   │   ├── walk.ts
│   │   │   ├── attack.ts
│   │   │   ├── feel.ts
│   │   │   ├── health.ts
│   │   │   ├── rest.ts
│   │   │   ├── rescue.ts
│   │   │   ├── shoot.ts
│   │   │   ├── look.ts
│   │   │   ├── pivot.ts
│   │   │   ├── bind.ts
│   │   │   ├── listen.ts
│   │   │   ├── detonate.ts
│   │   │   ├── explode.ts
│   │   │   ├── form.ts
│   │   │   ├── direction-of.ts
│   │   │   ├── direction-of-stairs.ts
│   │   │   └── distance-of.ts
│   │   └── units/             # ユニット群
│   │       ├── base.ts
│   │       ├── warrior.ts
│   │       ├── sludge.ts
│   │       ├── thick-sludge.ts
│   │       ├── archer.ts
│   │       ├── wizard.ts
│   │       ├── captive.ts
│   │       └── golem.ts
│   │
│   ├── levels/                # レベルデータ (JSON/TS)
│   │   ├── beginner/
│   │   │   ├── level-001.ts
│   │   │   ├── level-002.ts
│   │   │   └── ... (9 levels)
│   │   └── intermediate/
│   │       ├── level-001.ts
│   │       └── ... (9 levels)
│   │
│   ├── runtime/               # Python実行連携（Phase 2で新設）
│   │   ├── python-runner.ts   # Skulpt実行管理
│   │   ├── bridge.ts          # Python API → Engine橋渡し
│   │   └── py-builtins.ts     # warrior/space等のPythonバインディング
│   │
│   ├── renderer/              # ゲーム描画
│   │   ├── GameRenderer.ts    # Canvas描画メイン
│   │   ├── SpriteManager.ts   # スプライト読み込み・管理
│   │   ├── animation.ts       # アニメーションシステム
│   │   ├── tile-map.ts        # タイルマップ描画
│   │   └── effects.ts         # エフェクト(攻撃、回復等)
│   │
│   └── utils/
│       ├── constants.ts
│       ├── direction.ts       # 方向ユーティリティ
│       └── storage.ts         # localStorage管理
│
└── tests/
    ├── engine/                # エンジンユニットテスト
    ├── runtime/               # Python実行連携テスト（Phase 2で新設）
    ├── web/                   # UI挙動テスト（Phase 5で拡張）
    └── levels/                # レベル動作テスト
```

> 注: React化に伴い、旧来の `app.ts` / `ui/screens/*.ts` 想定は廃止。  
> 新規UIファイルは原則 `*.tsx`、非UIロジックは `*.ts` とする。

## Implementation Phases

### Phase 1-1: プロジェクトセットアップ & コアデータ構造

**目的**: ビルド環境構築と、ゲームエンジンの土台となるデータ構造を実装

1. Vite + TypeScript + Tailwind + Vitest プロジェクトセットアップ
2. 方向ユーティリティ (`direction.ts`):
   - 絶対方向 (north/east/south/west) と相対方向 (forward/backward/left/right)
   - 方向の回転・変換ロジック
3. `Position`: 座標 (x, y) + 向き + 移動・回転
4. `Space`: セル情報 (empty/wall/stairs/unit判定メソッド群)
5. `Floor`: 2Dグリッド管理、ユニット配置・取得・ASCII表示

**完了条件** (`npm test` 全Pass):
- [x] `direction.test.ts`: 絶対→相対変換、回転 (east向きでforward=east, left=north等)
- [x] `position.test.ts`: 移動 (translate)、回転 (rotate)、方向変換
- [x] `space.test.ts`: isEmpty/isWall/isStairs/isEnemy/isCaptive が正しい値を返す
- [x] `floor.test.ts`: グリッド生成、ユニット配置、座標でのSpace取得、ASCII表示 (character())

---

### Phase 1-2: ターンシステム & 最小プレイ可能セット

**目的**: Level 1〜3をプログラムで実行できる最小のゲームループを構築

1. `BaseAbility`: アビリティ共通基盤 (offset計算, space取得, damage処理)
2. `BaseUnit`: ユニット共通基盤 (HP, attack_power, position, bound状態, prepare/perform_turn)
3. `Turn`: ターンオブジェクト (アクション1つ + センス複数を登録)
4. 最小アビリティ: `walk`, `feel`, `health`, `attack`, `rest`
5. 最小ユニット: `Warrior`, `Sludge` (+ 敵AI)
6. `Level`: ターンループ、勝利/敗北判定、基本スコア計算
7. Beginnerレベル1〜3のデータ定義

**完了条件** (`npm test` 全Pass):
- [x] `turn.test.ts`: アクション1つ制限、センス複数OK、未アクションでのperform
- [x] `base-ability.test.ts`: offset計算、space取得
- [x] `walk.test.ts`: forward/backward移動で座標が正しく変化
- [x] `feel.test.ts`: 隣接Spaceが返る、壁/ユニット/空を正しく検出
- [x] `attack.test.ts`: ダメージ計算、backward半減、対象HP減少、死亡でposition=null
- [x] `health.test.ts`: 現在HPを返す
- [x] `rest.test.ts`: HP回復 (maxの10%, max超えない)
- [x] `warrior.test.ts`: 初期ステータス (HP=20, attack=5, shoot=3)
- [x] `sludge.test.ts`: 初期ステータス (HP=12, attack=3) + AI (隣接時attack)
- [x] `level-001.test.ts`: walkだけで7ターンでクリア (stairs到達=passed)
- [x] `level-002.test.ts`: feel+attackでSludge撃破→stairsでクリア
- [x] `level-003.test.ts`: 複数Sludge + rest回復を使ってクリア

---

### Phase 1-3: Beginnerタワー完成

**目的**: Beginner全9レベルをプレイ可能にする

1. 追加アビリティ: `rescue`, `shoot`, `look`, `pivot`, `bind`, `listen`, `direction_of_stairs`
2. 追加ユニット: `Archer`, `ThickSludge`, `Captive`, `Wizard` (+ 各敵AI)
3. Beginnerレベル4〜9のデータ定義
4. スコアリング完成: time_bonus, clear_bonus, ace_score, グレード計算

**完了条件** (`npm test` 全Pass):
- [x] 追加アビリティの各ユニットテスト (rescue/shoot/look/pivot/bind/listen/direction_of_stairs)
- [x] 追加ユニットの各ユニットテスト (Archer/ThickSludge/Captive/Wizard + AI)
- [x] `level-004.test.ts` 〜 `level-009.test.ts`: 各レベルの解答コードでクリア
- [x] `scoring.test.ts`: time_bonus計算、clear_bonus (全敵撃破時+20%)、ace_score、グレード (S/A/B/C/D/F)

---

### Phase 1-4: Intermediateタワー & ゲーム管理

**目的**: 全コンテンツとゲーム進行管理を完成

1. 追加アビリティ: `detonate`, `explode`, `form`, `direction_of`, `distance_of`
2. 追加ユニット: `Golem`
3. Intermediateレベル1〜9のデータ定義
4. `Tower`: レベル群管理、レベル進行
5. `Profile`: プレイヤー進行状態、アビリティ蓄積、localStorage保存
6. `Game`: 全体制御、Normal Mode / Epic Mode
7. Epic Mode: 全レベル連続プレイ、レベル別グレード、平均グレード

**完了条件** (`npm test` 全Pass):
- [x] 追加アビリティの各ユニットテスト (detonate/explode/form/direction_of/distance_of)
- [x] `golem.test.ts`: Golem生成、プレイヤーのformブロックでAI制御
- [x] `intermediate-level-001.test.ts` 〜 `009.test.ts`: 各レベルの解答コードでクリア
- [x] `tower.test.ts`: レベル一覧取得、次レベル進行
- [x] `profile.test.ts`: 保存/復元、アビリティ蓄積、スコア累計
- [x] `game.test.ts`: Normal Mode進行 (レベル順)、Epic Mode (全レベル連続+グレード計算)

---

### Phase 2: Python→JS変換層

**目的**: ユーザーのPythonコードをゲームエンジンに正しく接続し、既定値注入を廃止

1. Skulpt統合:
   - npm経由 or CDN経由でSkulptを導入
   - TypeScript型定義を追加
2. Python APIデザイン:

```python
# ユーザーが書くコード
class Player:
    def play_turn(self, warrior):
        space = warrior.feel()
        if space is None:
            warrior.walk()
        else:
            warrior.attack()
```

3. APIブリッジ実装:
   - `warrior` オブジェクトのPythonバインディング
   - アクション: `warrior.walk(direction)`, `warrior.attack(direction)`, etc.
   - センス: `warrior.feel(direction)`, `warrior.hp`, etc.
   - `Space` オブジェクトのバインディング: `space.is_enemy()`, `space.is_captive()`, etc.
   - 方向定数: Pythonでは文字列 `"forward"`, `"backward"`, `"left"`, `"right"`

4. Python命名規約への変換:
   - Ruby: `warrior.walk!`, `feel.empty?`, `direction_of_stairs`
   - Python: `warrior.walk()`, `space is None`, `warrior.direction_of_stairs()`

5. 既定値注入の廃止（最優先）:
   - UI内の固定コード/擬似AI依存を撤去
   - 「未入力時はテンプレート表示のみ」に変更（自動実行しない）
   - 入力コードが無効な場合は実行せず、明示エラーを返す

6. エラーハンドリング:
   - Python構文エラー → ユーザーフレンドリーなメッセージ
   - 実行時エラー → スタックトレース表示
   - 複数アクション実行の検出 → 警告

**完了条件** (`npm test` 全Pass):
- [x] `tests/runtime/python-runner.test.ts`: Python文字列 → Skulpt実行 → 戻り値取得
- [x] `tests/runtime/bridge.test.ts`: warrior.walk/attack/feel等のPython呼び出しがTurnに反映
- [x] `tests/runtime/py-builtins.test.ts`: Space→Python値変換（空マスの`None`化と述語バインディング）が正しい値
- [x] `tests/runtime/no-default-injection.test.ts`: 既定値コードが自動注入されない
- [x] `tests/runtime/python-level.test.ts`: Python解答コードでBeginner Level 1-3がクリア
- [x] `tests/runtime/python-error.test.ts`: 構文エラー/実行時エラーでユーザー向けメッセージが返る

---

### Phase 3: 基本Web UI & コードエディタ

**目的**: ゲーム可能な最小限のWeb UIを構築

1. 画面構成:
   - タイトル画面: ゲーム開始、名前入力、タワー選択
   - ゲーム画面: エディタ + ゲーム表示 + レベル情報
   - リザルト画面: スコア、グレード表示
2. CodeMirror 6 統合:
   - Python syntax highlighting
   - 基本的な補完 (warrior APIのメソッド)
   - エラーハイライト
3. ゲームコントロール:
   - Play (コード実行開始)
   - Pause/Resume (ターン間一時停止)
   - Reset (レベルリセット)
   - Speed control (ターン間隔調整)
4. ゲーム状態の ASCII 表示 (Phase 4までの仮表示):
   - Floor.character() のテキスト表示
   - ターンログ表示
5. レベル情報パネル:
   - レベル説明 (description)
   - ヒント (tip)
   - 追加ヒント (clue) - 失敗時に表示
   - 利用可能API一覧

**完了条件** (手動確認 + スモークテスト):
- [ ] ブラウザで `npm run dev` → タイトル画面表示
- [ ] 名前入力 → タワー選択 → ゲーム画面遷移
- [x] CodeMirrorでPythonコード入力 (syntax highlight有効)
- [x] Play押下 → ターンごとにASCII表示が更新
- [x] Pause/Resume/Reset が動作
- [ ] レベルクリア → スコア/グレード表示 → 次レベルへ進行
- [x] レベル失敗 → clue表示 → リトライ可能

---

### Phase 4: ゲームレンダラー & アニメーション（難航中・保留）

**目的**: ASCIIをビジュアルゲーム画面に置き換え

方針:
- Phase 4は新規実装を一時凍結し、インターフェース整理のみ継続
- 実装優先度は Phase 5（レンダラー非依存項目）を先行
- `RendererAdapter` を追加し、現状はASCII表示を継続利用

1. タイルマップシステム:
   - グリッドベース描画 (Canvas 2D)
   - 床、壁、階段タイル
   - レスポンシブなキャンバスサイズ
2. スプライトシステム:
   - スプライトシート読み込み
   - フレームアニメーション管理
   - 方向別スプライト (東西南北)
3. キャラクターアニメーション:
   - サムライ猫: idle, walk, attack, rest, rescue, damaged, victory
   - Sludge: idle, attack, damaged, death
   - Archer: idle, shoot, damaged, death
   - Captive: bound, rescued
   - 各ユニットの状態遷移アニメーション
4. エフェクト:
   - 攻撃エフェクト (斬撃)
   - 射撃エフェクト (矢)
   - 回復エフェクト (光)
   - ダメージ数値表示
   - レベルクリアエフェクト
5. ターン演出:
   - ターン間のスムーズなアニメーション遷移
   - カメラ/ビューポート追従 (大きいマップ対応)

**完了条件** (手動確認):
- [ ] ASCII表示がCanvas描画に置き換わっている
- [ ] サムライ猫がwalk時にアニメーション付きで移動
- [ ] attack時に斬撃エフェクト + 敵HPバー減少
- [ ] 敵撃破時にdeathアニメーション
- [ ] rest時に回復エフェクト
- [ ] レベルクリア時にvictoryアニメーション
- [ ] Beginner Level 1を通しプレイしてアニメーションが破綻しない

---

### Phase 5: UI洗練 & ゲーム体験完成

**目的**: Phase 4を待たずに進められるUI/運用価値を先行実装する

1. UI/UXデザイン刷新（Phase 4非依存範囲）:
   - 和風×サイバーパンク等のテーマ (要検討)
   - レスポンシブデザイン (モバイル対応)
   - ダークモード
2. i18n対応（先行実施）:
   - react-i18next 導入
   - 翻訳ファイル: `public/locales/{ja,en}/translation.json`
   - UI文字列全般 (メニュー、ボタン、通知等)
   - レベル説明・ヒント・clueの多言語化
   - 言語切り替えUI
3. チュートリアルシステム（ASCII表示のまま実装）:
   - レベル1の対話的チュートリアル
   - Python基礎構文のガイド
4. 進行管理（先行実施）:
   - localStorage保存/読み込み
   - プロファイル管理
5. 音声・BGM (optional):
   - SE (攻撃、移動、レベルクリア)
   - BGM (ゲームプレイ中)

**完了条件** (手動確認):
- [ ] 日本語⇔英語切り替えで全UIテキストが切り替わる
- [ ] レベル説明/ヒント/clueが多言語対応
- [ ] レスポンシブ: モバイル幅でレイアウト崩れなし
- [ ] ダークモード切り替え動作
- [ ] 既定コードが自動入力されず、テンプレート開始 or 空入力エラーになる
- [ ] Beginner全9レベル通しプレイ完走
- [ ] Epic Mode: 全レベル連続プレイ → 最終グレード表示

## Python API Reference (ユーザー向け)

```python
class Player:
    def play_turn(self, warrior):
        # ユーザーがこのメソッドを実装する
        pass

# === Actions (1ターンに1つだけ) ===
warrior.walk()              # 前方に移動 (デフォルト)
warrior.walk("backward")    # 後方に移動
warrior.attack()            # 前方を攻撃
warrior.attack("left")      # 左を攻撃
warrior.rest()              # 休息してHP回復
warrior.rescue()            # 前方の捕虜を救出
warrior.rescue("right")     # 右の捕虜を救出
warrior.shoot()             # 前方に射撃 (遠距離攻撃)
warrior.pivot()             # 後方を向く
warrior.pivot("right")      # 右を向く
warrior.bind()              # 前方の敵を拘束
warrior.detonate()          # 前方で爆破

# === Senses (何度でも使用可能) ===
warrior.feel()              # → Space | None (前方1マス)
warrior.feel("left")        # → Space | None (左1マス)
warrior.hp                  # → int (現在HP)
warrior.look()              # → list[Space | None] (前方3マス)
warrior.look("backward")    # → list[Space | None] (後方3マス)
warrior.listen()            # → list[Space] (ユニットがいるマスのみ)
warrior.direction_of_stairs()  # → str ("forward"等)
warrior.direction_of(space)    # → str (spaceへの相対方向)
warrior.distance_of(space)     # → int (spaceへのマンハッタン距離)

# === Space メソッド ===
space.is_stairs()           # bool
space.is_enemy()            # bool
space.is_captive()          # bool
space.is_wall()             # bool
```

## Key Design Decisions

### 1. Skulpt vs Pyodide vs カスタムトランスパイラ

**Skulpt採用**。理由:
- 軽量 (~1MB vs Pyodideの~10MB)
- 教育用途に設計 (CodeCombat等で実績)
- Python→JS変換方式で要件に合致
- 初回読み込みが速い

### 2. Canvas vs DOM vs WebGL

**Canvas 2D採用**。理由:
- タイルベースゲームに最適
- 外部依存なし
- スプライトアニメーション制御が容易
- パフォーマンス十分 (小規模グリッド)

### 3. フレームワーク選択

**React採用**。理由:
- 複数画面遷移 (タイトル/ゲーム/リザルト) の状態管理が容易
- react-i18nextによる成熟したi18n対応
- @uiw/react-codemirrorでエディタ統合がスムーズ
- エコシステム最大、ライブラリ選択肢が豊富

### 4. レベルデータ形式

**TypeScriptオブジェクト**。理由:
- Rubyの DSL を JSON化するよりTS関数の方が表現力が高い
- 型チェックが効く
- 動的なユニット配置やコールバック定義が容易

## Files to Reference (Original)

| Purpose | File |
|---------|------|
| ゲーム全体制御 | `original/ryanb-ruby-warrior/lib/ruby_warrior/game.rb` |
| レベル実行 | `original/ryanb-ruby-warrior/lib/ruby_warrior/level.rb` |
| フロア管理 | `original/ryanb-ruby-warrior/lib/ruby_warrior/floor.rb` |
| 空間情報 | `original/ryanb-ruby-warrior/lib/ruby_warrior/space.rb` |
| 座標管理 | `original/ryanb-ruby-warrior/lib/ruby_warrior/position.rb` |
| ターン制御 | `original/ryanb-ruby-warrior/lib/ruby_warrior/turn.rb` |
| プロファイル | `original/ryanb-ruby-warrior/lib/ruby_warrior/profile.rb` |
| アビリティ基底 | `original/ryanb-ruby-warrior/lib/ruby_warrior/abilities/base.rb` |
| ユニット基底 | `original/ryanb-ruby-warrior/lib/ruby_warrior/units/base.rb` |
| レベルデータ | `original/ryanb-ruby-warrior/towers/beginner/level_001.rb` 〜 `009.rb` |
| Webフロー参考 | `original/palkan-ruby-warrior/web/src/game.js` |
| Web VM参考 | `original/palkan-ruby-warrior/web/src/vm.js` |
