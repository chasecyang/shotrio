# Kie.ai 快速开始指南

## 🚀 3 步快速切换到 Kie.ai

### 步骤 1: 获取 API Key

访问 [https://kie.ai](https://kie.ai) 注册并获取 API Key

### 步骤 2: 配置环境变量

在 `.env.local` 文件中添加：

```bash
IMAGE_SERVICE_PROVIDER=kie
KIE_API_KEY=你的_kie_api_key
```

### 步骤 3: 重启服务

```bash
npm run dev
# 或
npm run build && npm start
```

## ✅ 完成！

现在所有图片生成功能都会使用 Kie.ai，**节省约 80% 的成本**！

## 💰 成本对比

| 操作 | Fal.ai | Kie.ai | 节省 |
|------|--------|--------|------|
| 生成 1 张图 | ~$0.10 | ~$0.02 | **80%** |
| 生成 100 张图 | ~$10.00 | ~$2.00 | **$8.00** |
| 生成 1000 张图 | ~$100.00 | ~$20.00 | **$80.00** |

## 🔄 回退到 Fal.ai

如需回退，只需修改环境变量：

```bash
IMAGE_SERVICE_PROVIDER=fal
```

## 📚 更多信息

查看完整文档: [kie-integration.md](./kie-integration.md)

## ❓ 常见问题

### Q: 是否需要修改代码？
A: **不需要**！所有代码已自动适配，只需配置环境变量。

### Q: 图片质量是否有差异？
A: Kie.ai 使用 Google Gemini 2.5 Flash 模型，质量相当，某些场景甚至更好。

### Q: 支持哪些功能？
A: 支持所有现有功能：
- ✅ 文生图
- ✅ 图生图（最多10张参考图）
- ✅ 所有宽高比
- ✅ PNG/JPEG 格式

### Q: 有使用限制吗？
A: 根据 Kie.ai 账号等级有不同的配额限制，请查看 [https://kie.ai/pricing](https://kie.ai/pricing)

## 🎯 推荐配置

```bash
# 开发环境：使用 kie（便宜）
IMAGE_SERVICE_PROVIDER=kie
KIE_API_KEY=your_dev_key

# 生产环境：也推荐使用 kie
IMAGE_SERVICE_PROVIDER=kie
KIE_API_KEY=your_prod_key
```

## 🔗 相关链接

- Kie.ai 官网: https://kie.ai
- Nano Banana 模型: https://kie.ai/nano-banana
- API 文档: https://kie.ai/docs
- 定价: https://kie.ai/pricing

