# X 长文封面生成器

在浏览器里输入标题和副标题，选一套配色，实时预览 5:2 封面，并下载 2400×960 的 PNG。没有后端，图片不会上传。

线上地址（Pages 开启并完成一次部署后）：<https://handsomejackson.github.io/x-cover-maker/>

## 本地运行

页面使用 ES Module，需要通过本地服务器打开，直接双击 `index.html` 会加载失败。

```bash
python3 -m http.server 4173 --directory site
```

然后打开 <http://localhost:4173> 。

排版测试：

```bash
node --test
```

## 封面

- 比例 5:2，导出 **2400×960** PNG。预览和下载共用同一次绘制，字体和换行一致。
- 标题用 Noto Serif SC，副标题用 Noto Sans SC。两套字体都随仓库分发（SIL Open Font License，见 `site/fonts/OFL.txt`），不依赖系统里有没有中文字体。
- 长标题自动换行并缩小字号，不截断。句号、逗号、闭括号不会落到下一行行首，开括号不会留在上一行行尾。中文和英文之间会留出一点间距。

## 部署到 GitHub Pages

合并到 `main` 后，`.github/workflows/pages.yml` 会把 `site/` 目录部署到 GitHub Pages。

工作流使用的 `GITHUB_TOKEN` 只有 `contents: read`、`pages: write` 和 `id-token: write`。开启 Pages、把 Source 改成 GitHub Actions，需要仓库的 **Administration** 权限。官方的 `actions/configure-pages` 也写明：自动开启 Pages 必须另备令牌，不能用默认的 `GITHUB_TOKEN`。

当前令牌调用 `POST /repos/handsomejackson/x-cover-maker/pages` 返回 **403 Resource not accessible by integration**，仓库的 Pages 站点也不存在（`GET` 返回 404）。所以这一步需要在网页上点一次：

1. 先把本分支合并进 `main`，让工作流文件出现在默认分支上。
2. 打开仓库的 **Settings → Pages**（<https://github.com/handsomejackson/x-cover-maker/settings/pages>）。
3. 在 **Build and deployment** 里，把 **Source** 选成 **GitHub Actions**。如果列表里出现工作流，选择「部署 GitHub Pages」。
4. 打开 **Actions**。如果仓库还没允许 Actions，先启用。合并当下的那次运行可能会因为 Pages 尚未开启而失败，点进失败的 run，选 **Re-run jobs**。也可以手动 **Run workflow**。
5. 部署成功后打开 <https://handsomejackson.github.io/x-cover-maker/> 。

如果这次部署停在 `github-pages` 环境等待批准，到仓库 **Settings → Environments → github-pages** 里通过它。个人公开仓库通常不需要这一步。
