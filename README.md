# 装配工坊

一个可在电脑和手机浏览器体验的工厂岗位训练游戏。

## 在线体验

- [公开在线版](https://zhuangpei-workshop.polite-chord-7994.chatgpt.site)
- [GitHub Pages](https://wthpein010-dev.github.io/assembly-workshop/)

可快速试玩，也可选择班组，定制角色外观并取名。模拟工位包含带教装内存、独立装配、质检、故障排查和实操认证演示。工友侧有聊天、双人训练、互助、礼物、工坊商店和建设周。用游戏内游玩码可以跨设备读取进度，联机大厅可邀请另一位真实玩家一起质检。

工序、实操认证和技能津贴均为产品演示。公开版本不需要任何真实员工资料。

## 本地运行

需要 Node.js 22.13 或更新版本。项目无安装依赖。

```sh
npm test
npm run build
npm start
```

本地地址为 `http://127.0.0.1:4178`。本地浏览器存档持续保存，本地联机测试数据库随服务退出而清空。线上 Worker 使用 D1。GitHub Pages 提供前端，联机 API 使用公开在线版的 Worker。
