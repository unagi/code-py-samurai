# Py Samurai

[English](README.md) | [日本語](README_ja.md)

[![CI](https://github.com/unagi/code-py-samurai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/ci.yml)
[![Codecov Upload](https://github.com/unagi/code-py-samurai/actions/workflows/codecov.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/codecov.yml)
[![CodeQL](https://github.com/unagi/code-py-samurai/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/codeql.yml)
[![Build](https://github.com/unagi/code-py-samurai/actions/workflows/sonarcloud.yml/badge.svg?branch=main)](https://github.com/unagi/code-py-samurai/actions/workflows/sonarcloud.yml)

Python 学習向けのブラウザゲームです。Ruby Warrior のゲーム性をベースに、Python で遊べるように移植・拡張しています。
A browser-based game for learning Python, ported and extended from the Ruby Warrior gameplay model.

## Acknowledgements

This project is a Python-focused fork based on [ryanb/ruby-warrior](https://github.com/ryanb/ruby-warrior).  
Thanks to the original project and its community.

## License

This repository is released under the **MIT License**. See `LICENSE` for details.  
The upstream project, [ryanb/ruby-warrior](https://github.com/ryanb/ruby-warrior), is also MIT-licensed.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run dev
```
