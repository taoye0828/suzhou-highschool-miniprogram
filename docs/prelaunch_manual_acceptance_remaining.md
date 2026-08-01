# PRELAUNCH-FINAL-MP 真实人工剩余事项

以下事项确实依赖微信账号、模拟器/真机或平台能力；没有把普通代码缺陷转嫁为人工事项。

1. 用已被正式 AppID `wxc2a2a94f767438dd` 授权为开发者的微信账号登录开发者工具；当前账号明确被平台拒绝。
2. 在最终 HEAD 上执行普通编译，确认 Problems=0、Console 无业务红色错误。
3. 完成五个 Tab、核心二级页和全部写入型用户路径；写入前先创建恢复点、Backup v3 与 before checksum，结束后验证 after checksum 完全一致。
4. 完成 320/375/390/414/430/iPad 的全页面布局、键盘、安全区、长文本和横屏检查。
5. 用真实手机预览；扫码和账号切换由用户完成。
6. 分别真实发送一次备份与报告文件，并验证取消、失败、重试与可信接收方提示。
7. 用户授权后上传体验版，在真实设备复验。
8. 用户授权后提交微信审核并记录审核系统结果。

完成 1—4 前不能确认 `PRE_RELEASE_UX_FREEZE_CONFIRMED`；完成开发者工具验收但尚未完成真机时，才可评估 `FIRST_SUBMISSION_CODE_READY_PENDING_REAL_DEVICE_ACCEPTANCE`。
