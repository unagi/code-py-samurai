# Python侍

[English](README.md) | [日本語](README_ja.md)

[![CI](https://github.com/unagi/code-py-samurai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/unagi/code-py-samurai/branch/main/graph/badge.svg)](https://codecov.io/gh/unagi/code-py-samurai)
[![CodeQL](https://github.com/unagi/code-py-samurai/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/codeql.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=unagi_code-py-samurai&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=unagi_code-py-samurai)

Ruby Warrior のゲーム性をベースに、Python で遊べるように移植・拡張した、Python 学習向けのブラウザゲームです。

## 謝辞

本プロジェクトは [ryanb/ruby-warrior](https://github.com/ryanb/ruby-warrior) を土台とした Python フォークです。  
オリジナルプロジェクトとコミュニティに感謝します。

## ライセンス

このリポジトリは **MIT License** で公開しています。詳細は `LICENSE` を参照してください。  
ベースとなる [ryanb/ruby-warrior](https://github.com/ryanb/ruby-warrior) も MIT License です。

## 開発

```bash
npm ci --ignore-scripts
npm test
npm run dev
```
