# Map Layout JSON Schema (Draft)

レベルのマップ配置情報を、配列座標ではなくオブジェクト座標で表現するためのスキーマ案です。

## 目的

- 座標を `{"x": number, "y": number}` で統一する
- `unitId` を明示的に持てるようにする
- UI演出（ダメージ表示など）でユニット追跡を安定化する

## スキーマ

```json
{
  "floor": { "width": 8, "height": 1 },
  "stairs": { "x": 7, "y": 0 },
  "warrior": {
    "unitId": "warrior",
    "position": { "x": 0, "y": 0 },
    "direction": "east"
  },
  "units": [
    {
      "unitId": "sludge#1",
      "type": "sludge",
      "position": { "x": 4, "y": 0 },
      "direction": "west"
    }
  ]
}
```

## 備考

- `unitId` は任意だが、複数敵がいるレベルでは付与推奨
- `position` は `warrior` と `units` で同じ形に統一
- 既存 `LevelDefinition` からの移行時は、旧構造を段階的に変換する
- Warrior の能力解放はマップ JSON ではなく `src/engine/warrior-abilities.ts` の増分定義で管理する
