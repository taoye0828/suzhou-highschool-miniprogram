# MP5 官方分数线来源与录入说明

本文件记录 MP5 固定官方来源、HTML 与图片 SHA256、提取方式、录入统计和跳过原因。`mp4_` 文档文件名为历史延续，当前 README 和相关文档内容已按 MP5 状态更新。

## 固定来源

### 4199.html

- 官方页面标题：2025年苏州市六区跨区招生各校分数线及最低控制线、自主招生最低控制线公布
- 官方页面 URL：https://www.szjyksy.com/Item/4199.aspx
- HTML 本地保存路径：docs/mp5_official_pages/4199.html
- HTML SHA256：8f23242a630957d814a6167c015ff6437794cc68c8572270c1634805d8622443
- 官方图片 URL：https://www.szjyksy.com/UploadFiles/zkxx/2025711102122.jpeg
- 图片本地保存路径：docs/mp5_official_images/2025711102122.jpeg
- 图片 SHA256：ea4a6f0e7f3288ac30b5c0980b2fec6c28ce942c05504bc3590a7fff172497cd
- 下载时间/核对日期：2026-07-06
- HTML 是否成功下载：是
- 图片是否成功下载：是
- 图片是否成功打开：是
- 是否成功识别：是，存在部分跳过行
- 数据提取方式：图片识别
- 提取说明：官方页面 HTML 源码未提供完整表格文字，仅包含页面内官方图片；本轮只依据该图片进行人工级识别并按 schoolId 规则筛选。
- 实际录入：36 条
- 跳过：5 条

### 4201.html

- 官方页面标题：2025年苏州市六区普通高中提前录取批次各校分数线公布
- 官方页面 URL：https://www.szjyksy.com/Item/4201.aspx
- HTML 本地保存路径：docs/mp5_official_pages/4201.html
- HTML SHA256：450df9e60c080b1ca51a21fe3a2f9e7451553c54f1854c493a537ee2a41bdfd8
- 官方图片 URL：https://www.szjyksy.com/UploadFiles/zkxx/2025711103329.jpeg
- 图片本地保存路径：docs/mp5_official_images/2025711103329.jpeg
- 图片 SHA256：4701d14d2d166d9aa0200c0088627fa8cc672ecff50dc005f7f9dcf4aba49b51
- 下载时间/核对日期：2026-07-06
- HTML 是否成功下载：是
- 图片是否成功下载：是
- 图片是否成功打开：是
- 是否成功识别：是，存在部分跳过行
- 数据提取方式：图片识别
- 提取说明：官方页面 HTML 源码未提供完整表格文字，仅包含页面内官方图片；本轮只依据该图片进行人工级识别并按 schoolId 规则筛选。
- 实际录入：35 条
- 跳过：21 条

### 4202.html

- 官方页面标题：2025年苏州市六区第一批次普通高中学校及现代职教体系项目录取分数线
- 官方页面 URL：https://www.szjyksy.com/Item/4202.aspx
- HTML 本地保存路径：docs/mp5_official_pages/4202.html
- HTML SHA256：c6f26519b262ff7c29e5a53930f7d634ff4047529e262627ed00c73d56fabc7f
- 官方图片 URL：https://www.szjyksy.com/UploadFiles/zkxx/20251029142432.jpeg
- 图片本地保存路径：docs/mp5_official_images/20251029142432.jpeg
- 图片 SHA256：2bb9f435012f98a871ffc8d7a1f1adc11a5fc3ff6e7bf31a204d76f394c86c8c
- 下载时间/核对日期：2026-07-06
- HTML 是否成功下载：是
- 图片是否成功下载：是
- 图片是否成功打开：是
- 是否成功识别：是，存在部分跳过行
- 数据提取方式：图片识别
- 提取说明：官方页面 HTML 源码未提供完整表格文字，仅包含页面内官方图片；本轮只依据该图片进行人工级识别并按 schoolId 规则筛选。
- 实际录入：32 条
- 跳过：34 条

## 按 sourceUrl 写入统计

| sourceUrl | 写入条数 | 跳过条数 |
| --- | ---: | ---: |
| https://www.szjyksy.com/Item/4199.aspx | 36 | 5 |
| https://www.szjyksy.com/Item/4201.aspx | 35 | 21 |
| https://www.szjyksy.com/Item/4202.aspx | 32 | 34 |

- admissionScores 实际总数：103 条
- 确认表记录总数：163 条

## 已录入 schoolId 对照

- 江苏省苏州中学园区校 -> 江苏省苏州中学园区校（suzhou_high_school_sip）；第一批次；统招生；录取最低分 683；最低中考语数外成绩：369；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州第十中学校（本部） -> 江苏省苏州第十中学校（suzhou_no10_high_school）；第一批次；统招生；录取最低分 652；最低中考语数外成绩：352；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州第十中学校（金阊校区） -> 江苏省苏州第十中学校金阊校区（suzhou_no10_high_school_jinchang）；第一批次；统招生；录取最低分 627；最低中考语数外成绩：332；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州第一中学校 -> 江苏省苏州第一中学校（suzhou_no1_high_school）；第一批次；统招生；录取最低分 663；最低中考语数外成绩：351；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市第三中学校（江苏省苏州外国语高级中学） -> 苏州市第三中学校（suzhou_no3_high_school）；第一批次；统招生；录取最低分 647；最低中考语数外成绩：347；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市第六中学校（江苏省苏州艺术高级中学） -> 苏州市第六中学校（suzhou_no6_high_school）；第一批次；统招生；录取最低分 585；最低中考语数外成绩：324；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州大学附属中学（东振路校区） -> 苏州大学附属中学（suda_affiliated_high_school）；第一批次；统招生；录取最低分 669；最低中考语数外成绩：341；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州大学附属中学（胜浦路校区） -> 苏州大学附属中学胜浦路校区（suda_affiliated_high_school_shengpu）；第一批次；统招生；录取最低分 642；最低中考语数外成绩：336；来源：https://www.szjyksy.com/Item/4202.aspx
- 南京航空航天大学苏州附属中学（星湖街校区） -> 南京航空航天大学苏州附属中学（nuaa_suzhou_affiliated_high_school）；第一批次；统招生；录取最低分 655；最低中考语数外成绩：334；来源：https://www.szjyksy.com/Item/4202.aspx
- 南京航空航天大学苏州附属中学（唯亭校区） -> 南京航空航天大学苏州附属中学唯亭校区（nuaa_suzhou_affiliated_high_school_weiting）；第一批次；统招生；录取最低分 632；最低中考语数外成绩：333；来源：https://www.szjyksy.com/Item/4202.aspx
- 西安交通大学苏州附属中学（方洲路校区） -> 西安交通大学苏州附属中学（xjtu_suzhou_affiliated_high_school）；第一批次；统招生；录取最低分 674；最低中考语数外成绩：355；来源：https://www.szjyksy.com/Item/4202.aspx
- 西安交通大学苏州附属中学（普惠路校区） -> 西安交通大学苏州附属中学普惠路校区（xjtu_suzhou_affiliated_high_school_puhui）；第一批次；统招生；录取最低分 663；最低中考语数外成绩：353；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州工业园区星海实验高级中学（苏茜路校区） -> 苏州工业园区星海实验高级中学（xinghai_experimental_high_school）；第一批次；统招生；录取最低分 687；最低中考语数外成绩：356；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州工业园区星海实验高级中学（沈浒路校区） -> 苏州工业园区星海实验高级中学沈浒路校区（xinghai_experimental_high_school_shenhu）；第一批次；统招生；录取最低分 678；最低中考语数外成绩：354；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州实验中学（本部） -> 江苏省苏州实验中学（suzhou_experimental_high_school）；第一批次；统招生；录取最低分 681；最低中考语数外成绩：360；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州实验中学（科技城校区） -> 江苏省苏州实验中学科技城校（suzhou_experimental_high_school_science_city）；第一批次；统招生；录取最低分 665；最低中考语数外成绩：345；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州实验中学（太湖科学城校区） -> 江苏省苏州实验中学太湖科学城校区（suzhou_experimental_high_school_taihu_science_city）；第一批次；统招生；录取最低分 656；最低中考语数外成绩：349；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州高新区第一中学（本部） -> 苏州高新区第一中学（suzhou_new_district_no1_high_school）；第一批次；统招生；录取最低分 658；最低中考语数外成绩：339；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州高新区第一中学（科技城校区） -> 苏州高新区第一中学科技城校区（suzhou_new_district_no1_high_school_science_city）；第一批次；统招生；录取最低分 643；最低中考语数外成绩：336；来源：https://www.szjyksy.com/Item/4202.aspx
- 吴县中学（本部） -> 苏州市吴县中学（wuxian_high_school）；第一批次；统招生；录取最低分 635；最低中考语数外成绩：337；来源：https://www.szjyksy.com/Item/4202.aspx
- 吴县中学（景山校区） -> 苏州市吴县中学景山校区（wuxian_high_school_jingshan）；第一批次；统招生；录取最低分 616；最低中考语数外成绩：331；来源：https://www.szjyksy.com/Item/4202.aspx
- 吴江中学 -> 吴江中学（wujiang_high_school）；第一批次；统招生；录取最低分 632；最低中考语数外成绩：329；来源：https://www.szjyksy.com/Item/4202.aspx
- 吴江高级中学 -> 吴江高级中学（wujiang_senior_high_school）；第一批次；统招生；录取最低分 607；最低中考语数外成绩：319；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市吴中区苏苑高级中学 -> 苏州市吴中区苏苑高级中学（suyuan_senior_high_school）；第一批次；统招生；录取最低分 647；最低中考语数外成绩：340；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省外国语学校 -> 江苏省外国语学校（jiangsu_foreign_language_school）；第一批次；统招生；录取最低分 626；最低中考语数外成绩：317；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市吴中区甪直高级中学 -> 苏州市吴中区甪直高级中学（luzhi_senior_high_school）；第一批次；统招生；录取最低分 610；最低中考语数外成绩：323；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省黄埭中学 -> 江苏省黄埭中学（huangdai_high_school）；第一批次；统招生；录取最低分 628；最低中考语数外成绩：327；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市相城区陆慕高级中学 -> 苏州市相城区陆慕高级中学（lumu_high_school）；第一批次；统招生；录取最低分 614；最低中考语数外成绩：323；来源：https://www.szjyksy.com/Item/4202.aspx
- 华中师范大学苏州实验高级中学 -> 华中师范大学苏州实验高级中学（huazhong_normal_suzhou_experimental_high_school）；第一批次；统招生；录取最低分 633；最低中考语数外成绩：335；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市吴中区东山中学 -> 苏州市吴中区东山中学（dongshan_senior_high_school）；第一批次；统招生；录取最低分 576；最低中考语数外成绩：285；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州大学实验学校 -> 苏州大学实验学校（suzhou_university_experimental_school）；第一批次；统招生；录取最低分 632；最低中考语数外成绩：329；来源：https://www.szjyksy.com/Item/4202.aspx
- 苏州市相城区望亭中学 -> 苏州市相城区望亭中学（wangting_high_school）；第一批次；统招生；录取最低分 584；最低中考语数外成绩：278；来源：https://www.szjyksy.com/Item/4202.aspx
- 江苏省苏州中学校 -> 江苏省苏州中学校（suzhou_high_school）；提前录取批次；自主招生；录取最低分 693；最低中考语数外成绩：369；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州中学校 国际融合课程项目 -> 江苏省苏州中学校（suzhou_high_school）；提前录取批次；国际融合课程项目；录取最低分 605；最低中考语数外成绩：324；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州中学校 国际书院课程项目 -> 江苏省苏州中学校（suzhou_high_school）；提前录取批次；国际书院课程项目；录取最低分 634；最低中考语数外成绩：329；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州中学园区校 西马国际课程项目 -> 江苏省苏州中学园区校（suzhou_high_school_sip）；提前录取批次；西马国际课程项目；录取最低分 583；最低中考语数外成绩：311；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州第十中学校（本部） 瑞云融创国际课程项目 -> 江苏省苏州第十中学校（suzhou_no10_high_school）；提前录取批次；瑞云融创国际课程项目；录取最低分 580；最低中考语数外成绩：306；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州第一中学校 圣陶创新高中课程教育项目 -> 江苏省苏州第一中学校（suzhou_no1_high_school）；提前录取批次；圣陶创新高中课程教育项目；录取最低分 593；最低中考语数外成绩：312；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州第一中学校 圣陶国际课程项目 -> 江苏省苏州第一中学校（suzhou_no1_high_school）；提前录取批次；圣陶国际课程项目；录取最低分 582；最低中考语数外成绩：312；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第三中学校 中美融合课程实验班（江苏省苏州外国语高级中学） -> 苏州市第三中学校（suzhou_no3_high_school）；提前录取批次；中美融合课程实验班；录取最低分 582；最低中考语数外成绩：286；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第三中学校 中日融合课程实验班 -> 苏州市第三中学校（suzhou_no3_high_school）；提前录取批次；中日融合课程实验班；录取最低分 616；最低中考语数外成绩：319；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州大学附属中学（东振路校区） 中加国际融合课程项目 -> 苏州大学附属中学（suda_affiliated_high_school）；提前录取批次；中加国际融合课程项目；录取最低分 590；最低中考语数外成绩：321；来源：https://www.szjyksy.com/Item/4201.aspx
- 西安交通大学苏州附属中学（方洲路校区） 中新国际融合课程项目 -> 西安交通大学苏州附属中学（xjtu_suzhou_affiliated_high_school）；提前录取批次；中新国际融合课程项目；录取最低分 598；最低中考语数外成绩：327；来源：https://www.szjyksy.com/Item/4201.aspx
- 西安交通大学苏州附属中学（普惠路校区） 香港DSE课程项目 -> 西安交通大学苏州附属中学普惠路校区（xjtu_suzhou_affiliated_high_school_puhui）；提前录取批次；香港DSE课程项目；录取最低分 588；最低中考语数外成绩：319；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州工业园区星海实验高级中学（沈浒路校区） 融致国际课程项目 -> 苏州工业园区星海实验高级中学沈浒路校区（xinghai_experimental_high_school_shenhu）；提前录取批次；融致国际课程项目；录取最低分 587；最低中考语数外成绩：304；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州实验中学（本部） 苏实国际创新课程项目 -> 江苏省苏州实验中学（suzhou_experimental_high_school）；提前录取批次；苏实国际创新课程项目；录取最低分 587；最低中考语数外成绩：313；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州高新区第一中学（科技城校区） 新枫国际课程项目 -> 苏州高新区第一中学科技城校区（suzhou_new_district_no1_high_school_science_city）；提前录取批次；新枫国际课程项目；录取最低分 590；最低中考语数外成绩：291；来源：https://www.szjyksy.com/Item/4201.aspx
- 吴县中学（本部） 中德国际课程班 -> 苏州市吴县中学（wuxian_high_school）；提前录取批次；中德国际课程班；录取最低分 580；最低中考语数外成绩：313；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第六中学校 表播 -> 苏州市第六中学校（suzhou_no6_high_school）；提前录取批次；表播；录取最低分 664；最低中考语数外成绩：292；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第六中学校 音乐 -> 苏州市第六中学校（suzhou_no6_high_school）；提前录取批次；音乐；录取最低分 659；最低中考语数外成绩：286；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第六中学校 舞蹈 -> 苏州市第六中学校（suzhou_no6_high_school）；提前录取批次；舞蹈；录取最低分 648；最低中考语数外成绩：301；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市第六中学校 美术 -> 苏州市第六中学校（suzhou_no6_high_school）；提前录取批次；美术；录取最低分 655；最低中考语数外成绩：297；来源：https://www.szjyksy.com/Item/4201.aspx
- 吴县中学（浒关校区） 美术特色课程班 -> 苏州市吴县中学浒关校区（wuxian_high_school_huguan）；提前录取批次；美术特色课程班；录取最低分 597；最低中考语数外成绩：258；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省震泽中学 -> 江苏省震泽中学（zhenze_high_school）；提前录取批次；自主招生；录取最低分 655；最低中考语数外成绩：340；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省震泽中学 育英国际课程班 -> 江苏省震泽中学（zhenze_high_school）；提前录取批次；育英国际课程班；录取最低分 585；最低中考语数外成绩：307；来源：https://www.szjyksy.com/Item/4201.aspx
- 青云实验中学中国传媒大学媒介素养课程班 -> 苏州市吴江区青云实验中学（wujiang_qingyun_experimental_school）；提前录取批次；中国传媒大学媒介素养课程班；录取最低分 534；最低中考语数外成绩：257；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省木渎高级中学 -> 江苏省木渎高级中学（mudu_senior_high_school）；提前录取批次；自主招生；录取最低分 664；最低中考语数外成绩：345；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市吴中区苏苑高级中学 清美班B类 -> 苏州市吴中区苏苑高级中学（suyuan_senior_high_school）；提前录取批次；清美班B类；录取最低分 636；最低中考语数外成绩：333；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市吴中区苏苑高级中学 国际书院课程班 -> 苏州市吴中区苏苑高级中学（suyuan_senior_high_school）；提前录取批次；国际书院课程班；录取最低分 586；最低中考语数外成绩：304；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省外国语学校 国际课程班 -> 江苏省外国语学校（jiangsu_foreign_language_school）；提前录取批次；国际课程班；录取最低分 518；最低中考语数外成绩：283；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市吴中区东山中学 体育特长生 -> 苏州市吴中区东山中学（dongshan_senior_high_school）；提前录取批次；体育特长生；录取最低分 524；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省黄埭中学 启新班 -> 江苏省黄埭中学（huangdai_high_school）；提前录取批次；启新班；录取最低分 653；最低中考语数外成绩：344；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市相城区陆慕高级中学 志远班 -> 苏州市相城区陆慕高级中学（lumu_high_school）；提前录取批次；志远班；录取最低分 628；最低中考语数外成绩：317；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州大学实验学校 东吴班 -> 苏州大学实验学校（suzhou_university_experimental_school）；提前录取批次；东吴班；录取最低分 645；最低中考语数外成绩：344；来源：https://www.szjyksy.com/Item/4201.aspx
- 相城中学 国际课程项目 -> 相城中学（xiangcheng_high_school）；提前录取批次；国际课程项目；录取最低分 618；最低中考语数外成绩：309；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市相城区望亭中学 风华美术班 -> 苏州市相城区望亭中学（wangting_high_school）；提前录取批次；风华美术班；录取最低分 588；最低中考语数外成绩：289；来源：https://www.szjyksy.com/Item/4201.aspx
- 苏州市相城区陆慕高级中学 凌云体育班 -> 苏州市相城区陆慕高级中学（lumu_high_school）；提前录取批次；凌云体育班；录取最低分 585；最低中考语数外成绩：293；来源：https://www.szjyksy.com/Item/4201.aspx
- 江苏省苏州中学校 -> 江苏省苏州中学校（suzhou_high_school）；跨区招生；跨区招生；录取最低分 701；最低中考语数外成绩：361；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州中学园区校 -> 江苏省苏州中学园区校（suzhou_high_school_sip）；跨区招生；跨区招生；录取最低分 688；最低中考语数外成绩：356；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州中学相城实验项目·李政道班（相城中学办班） -> 相城中学（xiangcheng_high_school）；跨区招生；跨区招生；录取最低分 687；最低中考语数外成绩：359；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州第十中学校（本部） -> 江苏省苏州第十中学校（suzhou_no10_high_school）；跨区招生；跨区招生；录取最低分 663；最低中考语数外成绩：344；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州第十中学校（金阊校区） -> 江苏省苏州第十中学校金阊校区（suzhou_no10_high_school_jinchang）；跨区招生；跨区招生；录取最低分 631；最低中考语数外成绩：329；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州第一中学校 -> 江苏省苏州第一中学校（suzhou_no1_high_school）；跨区招生；跨区招生；录取最低分 671；最低中考语数外成绩：345；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州市第三中学校（江苏省苏州外国语高级中学） -> 苏州市第三中学校（suzhou_no3_high_school）；跨区招生；跨区招生；录取最低分 646；最低中考语数外成绩：337；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州工业园区星海实验高级中学（苏茜路校区） -> 苏州工业园区星海实验高级中学（xinghai_experimental_high_school）；跨区招生；跨区招生；录取最低分 696；最低中考语数外成绩：367；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州工业园区星海实验高级中学（沈浒路校区） -> 苏州工业园区星海实验高级中学沈浒路校区（xinghai_experimental_high_school_shenhu）；跨区招生；跨区招生；录取最低分 688；最低中考语数外成绩：362；来源：https://www.szjyksy.com/Item/4199.aspx
- 西安交通大学苏州附属中学（方洲路校区） -> 西安交通大学苏州附属中学（xjtu_suzhou_affiliated_high_school）；跨区招生；跨区招生；录取最低分 683；最低中考语数外成绩：355；来源：https://www.szjyksy.com/Item/4199.aspx
- 西安交通大学苏州附属中学（普惠路校区） -> 西安交通大学苏州附属中学普惠路校区（xjtu_suzhou_affiliated_high_school_puhui）；跨区招生；跨区招生；录取最低分 675；最低中考语数外成绩：358；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州大学附属中学（东振路校区） -> 苏州大学附属中学（suda_affiliated_high_school）；跨区招生；跨区招生；录取最低分 675；最低中考语数外成绩：358；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州大学附属中学（胜浦路校区） -> 苏州大学附属中学胜浦路校区（suda_affiliated_high_school_shengpu）；跨区招生；跨区招生；录取最低分 655；最低中考语数外成绩：337；来源：https://www.szjyksy.com/Item/4199.aspx
- 南京航空航天大学苏州附属中学（星湖街校区） -> 南京航空航天大学苏州附属中学（nuaa_suzhou_affiliated_high_school）；跨区招生；跨区招生；录取最低分 654；最低中考语数外成绩：341；来源：https://www.szjyksy.com/Item/4199.aspx
- 南京航空航天大学苏州附属中学（唯亭校区） -> 南京航空航天大学苏州附属中学唯亭校区（nuaa_suzhou_affiliated_high_school_weiting）；跨区招生；跨区招生；录取最低分 641；最低中考语数外成绩：331；来源：https://www.szjyksy.com/Item/4199.aspx
- 人大附中苏州学校 -> 人大附中苏州学校（rdfz_suzhou_school）；跨区招生；跨区招生；录取最低分 676；最低中考语数外成绩：360；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州实验中学（本部） -> 江苏省苏州实验中学（suzhou_experimental_high_school）；跨区招生；跨区招生；录取最低分 694；最低中考语数外成绩：363；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州实验中学（科技城校区） -> 江苏省苏州实验中学科技城校（suzhou_experimental_high_school_science_city）；跨区招生；跨区招生；录取最低分 675；最低中考语数外成绩：358；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省苏州实验中学（太湖科学城校区） -> 江苏省苏州实验中学太湖科学城校区（suzhou_experimental_high_school_taihu_science_city）；跨区招生；跨区招生；录取最低分 657；最低中考语数外成绩：346；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州高新区第一中学（本部） -> 苏州高新区第一中学（suzhou_new_district_no1_high_school）；跨区招生；跨区招生；录取最低分 660；最低中考语数外成绩：352；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州高新区第一中学（科技城校区） -> 苏州高新区第一中学科技城校区（suzhou_new_district_no1_high_school_science_city）；跨区招生；跨区招生；录取最低分 651；最低中考语数外成绩：347；来源：https://www.szjyksy.com/Item/4199.aspx
- 吴县中学（本部） -> 苏州市吴县中学（wuxian_high_school）；跨区招生；跨区招生；录取最低分 634；最低中考语数外成绩：334；来源：https://www.szjyksy.com/Item/4199.aspx
- 吴县中学（景山校区） -> 苏州市吴县中学景山校区（wuxian_high_school_jingshan）；跨区招生；跨区招生；录取最低分 626；最低中考语数外成绩：330；来源：https://www.szjyksy.com/Item/4199.aspx
- 吴县中学（浒关校区） -> 苏州市吴县中学浒关校区（wuxian_high_school_huguan）；跨区招生；跨区招生；录取最低分 620；最低中考语数外成绩：321；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省震泽中学 -> 江苏省震泽中学（zhenze_high_school）；跨区招生；跨区招生；录取最低分 676；最低中考语数外成绩：352；来源：https://www.szjyksy.com/Item/4199.aspx
- 吴江中学 -> 吴江中学（wujiang_high_school）；跨区招生；跨区招生；录取最低分 656；最低中考语数外成绩：352；来源：https://www.szjyksy.com/Item/4199.aspx
- 吴江高级中学 -> 吴江高级中学（wujiang_senior_high_school）；跨区招生；跨区招生；录取最低分 623；最低中考语数外成绩：315；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省木渎高级中学 -> 江苏省木渎高级中学（mudu_senior_high_school）；跨区招生；跨区招生；录取最低分 683；最低中考语数外成绩：361；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州市吴中区苏苑高级中学 -> 苏州市吴中区苏苑高级中学（suyuan_senior_high_school）；跨区招生；跨区招生；录取最低分 663；最低中考语数外成绩：349；来源：https://www.szjyksy.com/Item/4199.aspx
- 华中师范大学苏州实验高级中学 -> 华中师范大学苏州实验高级中学（huazhong_normal_suzhou_experimental_high_school）；跨区招生；跨区招生；录取最低分 642；最低中考语数外成绩：337；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省外国语学校 -> 江苏省外国语学校（jiangsu_foreign_language_school）；跨区招生；跨区招生；录取最低分 633；最低中考语数外成绩：337；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州市吴中区甪直高级中学 -> 苏州市吴中区甪直高级中学（luzhi_senior_high_school）；跨区招生；跨区招生；录取最低分 616；最低中考语数外成绩：323；来源：https://www.szjyksy.com/Item/4199.aspx
- 相城中学 -> 相城中学（xiangcheng_high_school）；跨区招生；跨区招生；录取最低分 682；最低中考语数外成绩：355；来源：https://www.szjyksy.com/Item/4199.aspx
- 江苏省黄埭中学 -> 江苏省黄埭中学（huangdai_high_school）；跨区招生；跨区招生；录取最低分 663；最低中考语数外成绩：350；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州市相城区陆慕高级中学 -> 苏州市相城区陆慕高级中学（lumu_high_school）；跨区招生；跨区招生；录取最低分 639；最低中考语数外成绩：332；来源：https://www.szjyksy.com/Item/4199.aspx
- 苏州大学实验学校 -> 苏州大学实验学校（suzhou_university_experimental_school）；跨区招生；跨区招生；录取最低分 655；最低中考语数外成绩：361；来源：https://www.szjyksy.com/Item/4199.aspx

## 跳过行与原因

| 来源页面 | 来源图片 | 表格行号 | 官方学校名称或行内容 | 跳过原因 |
| --- | --- | --- | --- | --- |
| 4202.html | 20251029142432.jpeg | 22 | 吴县中学（浒关校区） | 分数与控制线数字重合，为避免误录，本轮不自动写入。 |
| 4202.html | 20251029142432.jpeg | 24 | 吴江盛泽中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 26 | 吴江汾湖高级中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 27 | 江苏省震泽中学育英学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 33 | 苏州市桃坞高级中学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 34 | 苏州市第五中学校 | 分数与控制线数字重合，为避免误录，本轮不自动写入。 |
| 4202.html | 20251029142432.jpeg | 35 | 苏州市田家炳实验高级中学（本部） | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 36 | 苏州市田家炳实验高级中学综合高中班（新市路220号） | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 37 | 吴江平望中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 38 | 吴江青云中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 39 | 吴江平望中学综合高中班项目（办班点-吴江中专） | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 40 | 吴江平望中学综合高中班项目（办班点-丝绸中专） | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 41 | 吴江平望中学综合高中班项目（办班点-汾湖职高） | 非普通高中学校分数线。 |
| 4202.html | 20251029142432.jpeg | 44 | 苏州市吴中区金山高级中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 45 | 苏州市吴中区金山高级中学（江苏省木渎高级中学办学点） | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 46 | 苏州市吴中区太湖综合高级中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 49 | 江苏省相城中等专业学校（职教高考班） | 非普通高中学校分数线。 |
| 4202.html | 20251029142432.jpeg | 50 | 苏州市相城区望亭中学（综合高中普职融通班） | 非普通高中学校分数线。 |
| 4202.html | 20251029142432.jpeg | 51 | 吴江青云实验中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 52 | 苏州枫华学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 53 | 苏州湾外国语学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 54 | 吴江区新教育学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 55 | 吴江区世恒学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 56 | 吴江区存志嘉德中学 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 57 | 吴江区新胜实验学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 58 | 吴江区滨之湖实验学校 | 无法和现有 schoolId 明确对应。 |
| 4202.html | 20251029142432.jpeg | 59 | 苏州高等职业技术学校-苏州科技大学“3+4”电子商务 | 现代职教体系项目暂不纳入普通高中分数线结构。 |
| 4202.html | 20251029142432.jpeg | 60 | 江苏省吴中中等专业学校-苏州工学院“3+4”新能源装备运行与维护 | 现代职教体系项目暂不纳入普通高中分数线结构。 |
| 4202.html | 20251029142432.jpeg | 61 | 江苏联合职业技术学院苏州建设交通分院-苏州城市学院“5+2”城市轨道车辆应用技术 | 现代职教体系项目暂不纳入普通高中分数线结构。 |
| 4202.html | 20251029142432.jpeg | 62 | 江苏联合职业技术学院苏州建设交通分院-苏州城市学院“5+2”环境艺术设计 | 现代职教体系项目暂不纳入普通高中分数线结构。 |
| 4202.html | 20251029142432.jpeg | 63 | 江苏联合职业技术学院苏州分院-苏州城市学院“5+2”现代通信技术 | 现代职教体系项目暂不纳入普通高中分数线结构。 |
| 4202.html | 20251029142432.jpeg | 64 | 江苏联合职业技术学院苏州分院-苏州城市学院“5+2”机电一体化技术 | 分数与控制线数字重合，为避免误录，本轮不自动写入。 |
| 4202.html | 20251029142432.jpeg | 65 | 姑苏区（直属）、工业园区、高新区民办高中最低录取控制线 | 控制线不是学校录取最低分。 |
| 4202.html | 20251029142432.jpeg | 66 | 指标生最低控制线：姑苏区（直属）、工业园区、高新区607分；吴江区583分；吴中区600分；相城区607分 | 控制线不是学校录取最低分。 |
| 4201.html | 2025711103329.jpeg | 2 | 苏州幼儿师范高等专科学校-苏州工学院“5+2”学前教育 | 非普通高中学校分数线。 |
| 4201.html | 2025711103329.jpeg | 3 | 盐城幼儿师范高等专科学校 学前教育 | 非普通高中学校分数线。 |
| 4201.html | 2025711103329.jpeg | 4 | 盐城幼儿师范高等专科学校 音乐教育 | 非普通高中学校分数线。 |
| 4201.html | 2025711103329.jpeg | 5 | 南通师范高等专科学校 学前教育 | 非普通高中学校分数线。 |
| 4201.html | 2025711103329.jpeg | 14 | 苏州市第五中学校 中日国际融合课程项目 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 15 | 南京航空航天大学苏州附属中学（星湖街校区）中纽国际融合课程项目 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 21 | 江苏省苏州实验中学（科技城校区） 加拿大BC省中加班项目 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 28 | 苏州市桃坞高级中学 有原国际艺术课程项目 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 29 | 苏州市桃坞高级中学 空乘基地班（中国民航） | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 30 | 苏州市桃坞高级中学 空乘基地班（国际航空） | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 31 | 苏州市桃坞高级中学 桃坞多元国际课程项目 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 35 | 吴江高级中学 国际课程班 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 37 | 苏州枫华学校足球特色班 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 38 | 青云实验中学国际课程班 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 39 | 苏州枫华学校国际课程班 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 40 | 苏州市吴江区新教育学校 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 41 | 苏州市吴江区世恒学校 | 无法和现有 schoolId 明确对应。 |
| 4201.html | 2025711103329.jpeg | 51 | 江苏省黄埭中学 中外融合教育项目 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 52 | 苏州市相城区陆慕高级中学 国际课程项目 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 53 | 苏州市相城区望亭中学 中韩国际课程项目 | 图片中学校名称或数字无法准确识别。 |
| 4201.html | 2025711103329.jpeg | 56 | 师范教育类专业录取最低控制线 | 控制线不是学校录取最低分。 |
| 4199.html | 2025711102122.jpeg | 27 | 吴江盛泽中学 | 无法和现有 schoolId 明确对应。 |
| 4199.html | 2025711102122.jpeg | 29 | 吴江汾湖高级中学 | 分数与控制线数字重合，为避免误录，本轮不自动写入。 |
| 4199.html | 2025711102122.jpeg | 30 | 江苏省震泽中学育英学校 | 无法和现有 schoolId 明确对应。 |
| 4199.html | 2025711102122.jpeg | 40 | 跨区招生录取最低控制线 | 控制线不是学校录取最低分。 |
| 4199.html | 2025711102122.jpeg | 41 | 苏州市六区自主招生最低控制线 | 控制线不是学校录取最低分。 |

## 控制线与项目处理规则

- 跨区招生录取最低控制线 603 分、苏州市六区自主招生最低控制线 600 分、指标生最低控制线、师范教育类专业控制线、民办高中最低控制线均不是某一学校录取最低分，不写入 `data/admission-scores.js`。
- 分数为 600 或 603 的学校行，本轮按特殊防错规则跳过，避免与控制线数字混淆。
- 现代职教体系项目、职业学校、中职、五年制高职等不属于本轮普通高中历史分数线结构，均不写入正式数据。
- 无法和 `data/schools.js` 中现有 `schoolId` 100% 对应的学校或项目不写入正式数据。
- 当前暂未收录 2026 年学校级录取分数线，原因是尚未在固定官方来源中核验到可录入数据；本轮只收录 2025 年官方历史分数线。

## HTML 与图片一致性

- 3 个 HTML 页面未提供完整结构化表格文字，只有页面标题、发布时间和页面内官方图片地址。
- 因 HTML 没有可比对的表格行，本轮不存在“HTML 源码文本与图片表格行冲突”的写入情况。
- 所有写入记录均来自官方页面内图片识别；图片中不清晰、缺少数字或未能稳定确认的行均未写入。

## 核对日期

- 2026-07-06
