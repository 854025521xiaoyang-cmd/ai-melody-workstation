# AI 旋律工作站

这是一个可实际使用的本地 demo 应用，当前包含 5 个页面：

- 首页：入口与当前版本说明
- 听歌识谱：上传音频，调用后端转谱，导出 `MusicXML`
- AI 创作：输入灵感并生成 3 个旋律版本，可试听、续写、改编、配和弦、换风格、保存项目
- 项目管理：查看、打开、导出、重命名、删除项目
- 设置：登录、注册、设置偏好

## 启动方式

先安装 Python 依赖：

```bash
pip install -r backend-python/requirements.txt
```

启动后端：

```bash
npm run dev:api
```

启动前端：

```bash
npm run dev
```

前端默认运行在：

- [http://localhost:4174](http://localhost:4174)

后端默认运行在：

- [http://localhost:8000](http://localhost:8000)

Vite 已经配置了代理，所以前端开发时会自动把 `/api`、`/generated`、`/test-audio` 转发到 `8000`。

## Render 部署

这个项目已经整理成适合 `Render` 的单服务部署方式：

- `Dockerfile`
- `.dockerignore`
- `render.yaml`

推荐做法：

1. 把这个项目放到一个 GitHub 仓库
2. 在 Render 里选择 `New +` -> `Blueprint`
3. 连接该 GitHub 仓库
4. Render 会识别 `render.yaml` 并按 Docker 方式部署

部署完成后，Render 会给你一个公开链接，别人直接打开就能访问。

## 当前真实可用能力

- 识谱上传与 `MusicXML` 导出
- AI 创作参数表单
- 生成旋律版本
- AI 续写
- AI 改编
- AI 配和弦
- AI 换风格
- 项目保存 / 打开 / 删除 / 重命名 / 导出
- 设置读取与保存
- 登录 / 注册 / 退出

## 当前限制

- “AI 创作”目前使用的是后端可控生成逻辑，不是外部大模型
- 支付相关接口仍然是占位接口
- 项目分享目前是复制摘要，不是云端分享
