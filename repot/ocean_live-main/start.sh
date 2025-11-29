#!/bin/bash

echo "🚀 啟動 WebRTC 直播平台..."
echo

echo "📋 檢查 Node.js 安裝..."
if ! command -v node &> /dev/null; then
    echo "❌ 未安裝 Node.js，請先安裝 Node.js 14.0.0 或以上版本"
    echo "📥 下載地址：https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 已安裝"
echo

echo "📦 安裝依賴套件..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 安裝依賴失敗"
    exit 1
fi

echo "✅ 依賴安裝完成"
echo

echo "🌐 啟動直播服務器..."
echo "📺 主播端：http://localhost:3000/livestream_platform.html"
echo "👥 觀眾端：http://localhost:3000/viewer.html"
echo
echo "按 Ctrl+C 停止服務器"
echo

npm start
