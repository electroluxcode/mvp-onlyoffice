#!/bin/bash

# 复制 Transformers.js 的 WASM 文件到 public 目录
# 在升级 @huggingface/transformers 包后运行此脚本

echo "📦 正在复制 WASM 文件..."

# 创建目标目录
mkdir -p public/wasm

# 复制 WASM 运行时文件
cp node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.* public/wasm/

echo "✅ WASM 文件复制完成！"
echo ""
ls -lh public/wasm/

