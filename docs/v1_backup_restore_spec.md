# Backup v3 与 Restore Point v2

新备份格式为 Backup v3，新恢复点格式为 Restore Point v2。二者共用 `utils/canonical-json.js` 和 `utils/checksum.js` 的 UTF-8 canonical JSON + SHA-256。FNV-1a 仅用于读取既有 Backup v2。

导入门禁覆盖 4 MB 文件限制、40 层 JSON 深度、危险对象键、版本、摘要、档案和实体数量、重复 ID、profileId、schoolId 与跨实体引用。Backup v2（Schema v4）经适配器读入并归一化为 v5；高版本拒绝。

Restore Point v1 保持只读兼容；Restore Point v2 写入并校验 restore point、storage、backup、appData 四类版本、SHA-256、scope、摘要、payload 大小和恢复后的引用完整性。单档案恢复默认不改共享收藏；已删除档案可恢复为新档案。

备份合并按实体业务键、version、updatedAt 决定；本机设置默认保留，只有显式选择备份设置才替换。相同备份每次导入都创建新的安全恢复点。

文件只在用户主动点击后通过微信系统能力发送；取消不记成功，失败不修改用户数据并可重试。
