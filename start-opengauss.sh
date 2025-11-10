#!/bin/bash

# openGauss MCP Server 启动脚本

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 检查必需的环境变量
if [ -z "$OPENGAUSS_HOST" ] || [ -z "$OPENGAUSS_USER" ] || [ -z "$OPENGAUSS_PASSWORD" ]; then
    echo "错误: 缺少必需的环境变量"
    echo "请设置: OPENGAUSS_HOST, OPENGAUSS_USER, OPENGAUSS_PASSWORD"
    exit 1
fi

# 检查 dist 目录是否存在
if [ ! -d "dist" ]; then
    echo "正在构建项目..."
    npm run build
fi

# 启动服务器
echo "正在启动 openGauss MCP Server..."
echo "主机: $OPENGAUSS_HOST:${OPENGAUSS_PORT:-5432}"
echo "数据库: ${OPENGAUSS_DATABASE:-postgres}"
echo "Schema: ${OPENGAUSS_SCHEMA:-public}"
echo ""

node dist/index.js






