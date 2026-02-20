#!/bin/bash
# Phase 1 extraction runner with CUDA DLL paths
# Usage: bash run_phase1.sh [warrior-01|warrior-02|...|tiles-01|all]

cd "$(dirname "$0")"

# Add nvidia DLLs to PATH for onnxruntime CUDA provider
VENV_SP=".venv/Lib/site-packages/nvidia"
export PATH="$PATH:$(cygpath -w "$VENV_SP/cudnn/bin"):$(cygpath -w "$VENV_SP/cublas/bin")"

uv run python phase1_extract.py "${1:-all}"
